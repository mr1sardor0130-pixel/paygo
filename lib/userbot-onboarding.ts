import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'

export type OnboardingStep =
  | 'awaiting_api_id'
  | 'awaiting_api_hash'
  | 'awaiting_phone'
  | 'awaiting_code'
  | 'awaiting_2fa'
  | 'connected'
  | 'error'

export type OnboardingState = {
  step: OnboardingStep
  apiId?: number
  apiHash?: string
  phone?: string
  phoneCodeHash?: string
  client?: TelegramClient
  error?: string
  expiresAt: number
}

const states = new Map<string, OnboardingState>()
const ttl = 15 * 60 * 1000 // 15 minutes session TTL

export function beginOnboarding(userId: string): OnboardingState {
  // Disconnect any existing client
  const existing = states.get(userId)
  if (existing?.client) {
    try {
      existing.client.disconnect()
    } catch {}
  }

  const state: OnboardingState = { step: 'awaiting_api_id', expiresAt: Date.now() + ttl }
  states.set(userId, state)
  return state
}

export function setApiId(userId: string, apiId: number): OnboardingState {
  const current = getOnboarding(userId) ?? beginOnboarding(userId)
  const updated: OnboardingState = { ...current, apiId, step: 'awaiting_api_hash', expiresAt: Date.now() + ttl }
  states.set(userId, updated)
  return updated
}

export function setApiHash(userId: string, apiHash: string): OnboardingState {
  const current = getOnboarding(userId)
  if (!current?.apiId) throw new Error('API ID topilmadi. Qaytadan boshlang.')
  const updated: OnboardingState = { ...current, apiHash: apiHash.trim(), step: 'awaiting_phone', expiresAt: Date.now() + ttl }
  states.set(userId, updated)
  return updated
}

export function getOnboarding(userId: string): OnboardingState | null {
  const state = states.get(userId)
  if (!state || state.expiresAt < Date.now()) {
    states.delete(userId)
    return null
  }
  return state
}

export function cancelOnboarding(userId: string) {
  const state = states.get(userId)
  if (state?.client) {
    try {
      state.client.disconnect()
    } catch {}
  }
  states.delete(userId)
}

export async function startTelegramLogin(userId: string, phone: string): Promise<OnboardingState> {
  const state = getOnboarding(userId)
  if (!state?.apiId || !state.apiHash) {
    throw new Error('API ID va API Hash kiritilmagan. Iltimos avval ularni kiriting.')
  }

  const cleanPhone = phone.replace(/[^0-9+]/g, '').trim()
  if (cleanPhone.length < 9) {
    throw new Error('Telefon raqami noto‘g‘ri formatda (+998901234567).')
  }

  // Disconnect previous client if any
  if (state.client) {
    try {
      await state.client.disconnect()
    } catch {}
  }

  const client = new TelegramClient(new StringSession(''), state.apiId, state.apiHash, {
    connectionRetries: 5,
  })

  await client.connect()

  const sent = await client.sendCode(
    { apiId: state.apiId, apiHash: state.apiHash },
    cleanPhone
  )

  const updated: OnboardingState = {
    ...state,
    step: 'awaiting_code',
    phone: cleanPhone,
    phoneCodeHash: sent.phoneCodeHash,
    client,
    expiresAt: Date.now() + ttl,
  }
  states.set(userId, updated)
  return updated
}

export async function verifyTelegramCode(
  userId: string,
  rawCode: string,
  password?: string
): Promise<{ needsPassword: boolean; sessionString?: string; error?: string }> {
  const state = getOnboarding(userId)
  if (!state?.client || !state.phone || !state.phoneCodeHash) {
    throw new Error('Login sessiyasi topilmadi yoki muddati tugagan. Qaytadan boshlang.')
  }

  // Strip non-digits (handles formats like "2.1.2.3.4", "2 1 2 3 4", "2-1-2-3-4")
  const cleanCode = rawCode.replace(/\D/g, '').trim()
  if (!cleanCode) {
    throw new Error('Tasdiqlash kodi kiritilmadi (masalan: 2.1.2.3.4).')
  }

  try {
    const { Api } = await import('telegram/tl')
    await state.client.invoke(
      new Api.auth.SignIn({
        phoneNumber: state.phone,
        phoneCodeHash: state.phoneCodeHash,
        phoneCode: cleanCode,
      })
    )
  } catch (error: any) {
    const errorMsg = String(error?.errorMessage ?? error?.message ?? '')
    if (errorMsg.includes('SESSION_PASSWORD_NEEDED') || errorMsg.includes('2FA') || errorMsg.includes('PASSWORD_HASH_INVALID')) {
      if (!password) {
        states.set(userId, { ...state, step: 'awaiting_2fa', expiresAt: Date.now() + ttl })
        return { needsPassword: true }
      }
      try {
        const { computeCheck } = await import('telegram/Password')
        const { Api } = await import('telegram/tl')
        const passwordSrpResult = await state.client.invoke(new Api.account.GetPassword())
        const passwordSrpCheck = await computeCheck(passwordSrpResult, password)
        await state.client.invoke(new Api.auth.CheckPassword({ password: passwordSrpCheck }))
      } catch (pwdErr: any) {
        throw new Error(pwdErr?.errorMessage ?? pwdErr?.message ?? '2FA paroli noto‘g‘ri')
      }
    } else {
      throw new Error(error?.errorMessage ?? error?.message ?? 'Telegram kodini tekshirishda xatolik yuz berdi')
    }
  }

  const sessionString = state.client.session.save() as unknown as string
  states.set(userId, { ...state, step: 'connected', expiresAt: Date.now() + ttl })
  return { needsPassword: false, sessionString }
}

export async function submitTelegram2FA(
  userId: string,
  password: string
): Promise<{ sessionString: string }> {
  const state = getOnboarding(userId)
  if (!state?.client) {
    throw new Error('Login sessiyasi topilmadi. Qaytadan /userbot orqali boshlang.')
  }

  try {
    const { computeCheck } = await import('telegram/Password')
    const { Api } = await import('telegram/tl')
    const passwordSrpResult = await state.client.invoke(new Api.account.GetPassword())
    const passwordSrpCheck = await computeCheck(passwordSrpResult, password)
    await state.client.invoke(new Api.auth.CheckPassword({ password: passwordSrpCheck }))
  } catch (error: any) {
    const msg = String(error?.errorMessage ?? error?.message ?? '')
    if (msg.includes('PASSWORD_HASH_INVALID') || msg.includes('PASSWORD_EMPTY')) {
      throw new Error('2FA paroli noto‘g‘ri. Qaytadan parolni yuboring:')
    }
    throw new Error(error?.errorMessage ?? error?.message ?? '2FA paroli noto‘g‘ri.')
  }

  const sessionString = state.client.session.save() as unknown as string
  states.set(userId, { ...state, step: 'connected', expiresAt: Date.now() + ttl })
  return { sessionString }
}

