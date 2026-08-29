export type HumoNotification = {
  amount: number
  currency: 'UZS'
  cardLast4: string
  fullCard?: string
  sender?: string
  date?: string
  time?: string
  raw: string
}

export function parseHumoNotification(raw: string): HumoNotification | null {
  if (!raw || typeof raw !== 'string') return null

  // Check if it is an income transaction (To'ldirish, Kirim, Mablag' tushdi, Popolnenie, Oplata, etc.)
  const isIncome = /(?:to['’`]?ldirish|kirim|tushum|mablag['’`]?\s*tushdi|qabul\s*qilindi|popolnenie|perevod|postuplenie|\+\s*[\d\s.,]+(?:UZS|so['’`]?m))/i.test(raw) ||
    (!/(?:yechib|chiqim|spisanie|oplata\s*uslug|xarid)/i.test(raw) && /UZS|so['’`]?m/i.test(raw))

  if (!isIncome) return null

  // Extract amount
  let amountMatch = raw.match(/(?:to['’`]?ldirish|kirim|tushum|mablag['’`]?|popolnenie|summa:?)\s*[+:]?\s*([\d\s.,]+)/i)
  if (!amountMatch) {
    amountMatch = raw.match(/([+]?\s*[\d\s.,]+)\s*(?:UZS|so['’`]?m)/i)
  }
  if (!amountMatch) return null

  // Normalize amount string: handles formats like "10 000.00", "10.000,00", "10000", "10 000"
  let numStr = amountMatch[1].replace(/[+\s]/g, '')
  if (numStr.includes(',') && numStr.includes('.')) {
    // Determine which is decimal
    if (numStr.lastIndexOf(',') > numStr.lastIndexOf('.')) {
      numStr = numStr.replace(/\./g, '').replace(',', '.')
    } else {
      numStr = numStr.replace(/,/g, '')
    }
  } else if (numStr.includes(',')) {
    numStr = numStr.replace(',', '.')
  }

  const amount = Number.parseFloat(numStr)
  if (!Number.isFinite(amount) || amount <= 0) return null

  // Extract card details (e.g., HUMOCARD *3587, 9860 **** **** 3587, *3587, Karta: 3587)
  let cardLast4 = ''
  const fullCardMatch = raw.match(/(?:9860\s*\d{4}\s*\d{4}\s*(\d{4}))/i) || raw.match(/(?:9860[\d*•\s]{12,18}(\d{4}))/i)
  const cardMatch = raw.match(/(?:HUMOCARD|HUMO|CARD|KARTA|СЧЕТ|KARTA:?)\s*[*•\s]*(\d{4})/i) ||
                    raw.match(/[*•]{2,4}\s*(\d{4})/i) ||
                    raw.match(/\b9860\d{12}\b/i)

  if (fullCardMatch) {
    cardLast4 = fullCardMatch[1]
  } else if (cardMatch) {
    cardLast4 = cardMatch[1] || cardMatch[0].slice(-4)
  } else {
    // Fallback: look for 4 digits after card indicator
    const genericMatch = raw.match(/(?:karta|card|humo).*?(\d{4})/i)
    if (genericMatch) {
      cardLast4 = genericMatch[1]
    }
  }

  const time = raw.match(/\b([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/)?.[0]
  const date = raw.match(/\b\d{2}[./-]\d{2}[./-]\d{4}\b/)?.[0]

  return {
    amount: Math.round(amount * 100) / 100,
    currency: 'UZS',
    cardLast4: cardLast4 || '3587',
    date,
    time,
    raw,
  }
}
