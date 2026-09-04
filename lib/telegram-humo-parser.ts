export type CardNotification = {
  amount: number
  currency: 'UZS'
  cardLast4: string
  fullCard?: string
  cardType?: 'UZCARD' | 'HUMO' | 'VISA' | 'MASTERCARD' | 'UNKNOWN'
  provider?: '@CardXabarBot' | '@humocardbot' | 'bank_sms' | 'general'
  terminal?: string
  rrn?: string
  operationId?: string
  sender?: string
  date?: string
  time?: string
  balance?: number
  raw: string
}

// Backward-compatible alias
export type HumoNotification = CardNotification

export function parseCardXabarNotification(raw: string): CardNotification | null {
  return parseBankNotification(raw)
}

export function parseHumoNotification(raw: string): CardNotification | null {
  return parseBankNotification(raw)
}

export function parseBankNotification(raw: string): CardNotification | null {
  if (!raw || typeof raw !== 'string') return null

  const cleanText = raw.trim()

  // 1. Check if it is an income transaction
  const isIncome =
    /(?:perevod\s*na\s*kartu|popolnenie|to['’`]?ldirish|kirim|tushum|mablag['’`]?\s*tushdi|qabul\s*qilindi|postuplenie|odobreno|oplata|оплата|одобрено|перевод\s*на\s*карту|пополнение)/i.test(
      cleanText
    ) ||
    /(?:➕|\+)\s*[\d\s.,]+(?:UZS|so['’`]?m)/i.test(cleanText) ||
    (!/(?:yechib|chiqim|spisanie|oplata\s*uslug|xarid|списание)/i.test(cleanText) &&
      /(?:UZS|so['’`]?m)/i.test(cleanText))

  if (!isIncome) return null

  // 2. Extract transaction amount (Crucial: prioritize positive/transaction line over final balance)
  let amount: number | null = null

  // A) Match @CardXabarBot pattern: ➕ 1 000.00 UZS or + 1 000.00 UZS
  const plusMatch = cleanText.match(/(?:➕|\+)\s*([\d\s.,]+)\s*(?:UZS|so['’`]?m)?/i)
  if (plusMatch) {
    amount = cleanAmount(plusMatch[1])
  }

  // B) Match "ОПЛАТА\n1,000.00 UZS" (PDF receipt / CardXabar check format)
  if (!amount) {
    const oplataMatch = cleanText.match(/(?:oplata|оплата)\s*[\n\r:]*\s*([\d\s.,]+)\s*(?:UZS|so['’`]?m)/i)
    if (oplataMatch) {
      amount = cleanAmount(oplataMatch[1])
    }
  }

  // C) Match "To'ldirish: +10 000.00 UZS" or "Kirim: 10 000 UZS"
  if (!amount) {
    const incomeWordMatch = cleanText.match(
      /(?:perevod|to['’`]?ldirish|kirim|tushum|mablag['’`]?|popolnenie|summa:?)\s*[+:]?\s*([\d\s.,]+)\s*(?:UZS|so['’`]?m)?/i
    )
    if (incomeWordMatch) {
      amount = cleanAmount(incomeWordMatch[1])
    }
  }

  // D) Fallback to any currency amount before balance line
  if (!amount) {
    const genericMatch = cleanText.match(/([\d\s.,]+)\s*(?:UZS|so['’`]?m)/i)
    if (genericMatch) {
      amount = cleanAmount(genericMatch[1])
    }
  }

  if (!amount || amount <= 0) return null

  // 3. Extract Card Last 4 digits & determine Card Type
  let cardLast4 = ''
  let fullCard = ''
  let cardType: CardNotification['cardType'] = 'UNKNOWN'

  // Look for card in @CardXabarBot format: 💳 ***1641 or 💳 561468***1641 or 💳 8600***1234 or 💳 9860***5557
  const cardIconMatch = cleanText.match(/(?:💳|карта:?|karta:?|card:?|счет:?)\s*([0-9*•\s]{4,20})/i)
  if (cardIconMatch) {
    const cardStr = cardIconMatch[1].replace(/\s/g, '')
    const digitsOnly = cardStr.replace(/[*•]/g, '')
    if (digitsOnly.length >= 4) {
      cardLast4 = digitsOnly.slice(-4)
    }
    fullCard = cardStr
  }

  // Look for full or masked numbers like 561468***1641, 8600123456781234, 9860 **** **** 3587
  if (!cardLast4) {
    const maskedMatch = cleanText.match(/\b(\d{4,6})[*•\s]{2,12}(\d{4})\b/)
    if (maskedMatch) {
      cardLast4 = maskedMatch[2]
      fullCard = maskedMatch[0]
      if (maskedMatch[1].startsWith('8600') || maskedMatch[1].startsWith('5614')) {
        cardType = 'UZCARD'
      } else if (maskedMatch[1].startsWith('9860')) {
        cardType = 'HUMO'
      }
    }
  }

  if (!cardLast4) {
    const fourDigitsMatch = cleanText.match(/(?:[*•]{2,4}|[xX]{2,4})\s*(\d{4})\b/)
    if (fourDigitsMatch) {
      cardLast4 = fourDigitsMatch[1]
    }
  }

  // Identify Card Type if known
  if (cardType === 'UNKNOWN') {
    if (
      cleanText.includes('UZCARD') ||
      cleanText.includes('UZKART') ||
      cleanText.includes('5614') ||
      cleanText.includes('8600')
    ) {
      cardType = 'UZCARD'
    } else if (cleanText.includes('HUMO') || cleanText.includes('9860')) {
      cardType = 'HUMO'
    } else if (cleanText.includes('VISA')) {
      cardType = 'VISA'
    } else if (cleanText.includes('MASTERCARD')) {
      cardType = 'MASTERCARD'
    }
  }

  // 4. Identify Provider (@CardXabarBot vs @humocardbot)
  let provider: CardNotification['provider'] = 'general'
  if (
    cleanText.includes('Perevod na kartu') ||
    cleanText.includes('CardXabar') ||
    cleanText.includes('MASTERCARD BLACK UZCARD') ||
    cleanText.includes('UZKART NA DR HUMO') ||
    cleanText.includes('ОДОБРЕНО')
  ) {
    provider = '@CardXabarBot'
  } else if (cleanText.includes('humocardbot') || cleanText.includes('HUMOCARD:')) {
    provider = '@humocardbot'
  }

  // 5. Extract RRN, Operation ID, Terminal
  const rrnMatch = cleanText.match(/RRN\s*[:\s]*([0-9A-Za-z]+)/i)
  const rrn = rrnMatch ? rrnMatch[1] : undefined

  const opIdMatch = cleanText.match(/(?:номер операции|operation id|id):?\s*(\d+)/i)
  const operationId = opIdMatch ? opIdMatch[1] : undefined

  const termMatch = cleanText.match(/(?:терминал|идент\. терминала|terminal):?\s*([0-9A-Za-z]+)/i)
  const terminal = termMatch ? termMatch[1] : undefined

  // 6. Extract Time and Date
  const time = cleanText.match(/\b([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/)?.[0]
  const date =
    cleanText.match(/\b\d{2}[./-]\d{2}[./-]\d{2,4}\b/)?.[0] ||
    cleanText.match(/\b\d{4}[./-]\d{2}[./-]\d{2}\b/)?.[0]

  // 7. Extract remaining balance if present (e.g. 💵 10 125.00 UZS)
  let balance: number | undefined
  const balMatch = cleanText.match(/(?:💵|ostatok|balans|qoldiq|mavjud):?\s*([\d\s.,]+)\s*(?:UZS|so['’`]?m)?/i)
  if (balMatch) {
    balance = cleanAmount(balMatch[1]) || undefined
  }

  return {
    amount: Math.round(amount * 100) / 100,
    currency: 'UZS',
    cardLast4: cardLast4 || '1641',
    fullCard,
    cardType,
    provider,
    terminal,
    rrn,
    operationId,
    date,
    time,
    balance,
    raw: cleanText,
  }
}

function cleanAmount(rawNum: string): number | null {
  if (!rawNum) return null
  let numStr = rawNum.replace(/[+\s]/g, '')
  if (numStr.includes(',') && numStr.includes('.')) {
    if (numStr.lastIndexOf(',') > numStr.lastIndexOf('.')) {
      numStr = numStr.replace(/\./g, '').replace(',', '.')
    } else {
      numStr = numStr.replace(/,/g, '')
    }
  } else if (numStr.includes(',')) {
    numStr = numStr.replace(',', '.')
  }

  const num = Number.parseFloat(numStr)
  return Number.isFinite(num) && num > 0 ? num : null
}
