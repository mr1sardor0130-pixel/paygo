import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function generateReceiptPdfBuffer(details: {
  paymentId: string
  title: string
  amount: number
  cardNumber: string
  cardOwner: string
  date: string
  userId: string
  status: string
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 size
  const { width, height } = page.getSize()

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 110,
    width: width,
    height: 110,
    color: rgb(0.09, 0.41, 0.88), // #1769e0 PayGo Primary Blue
  })

  // Title inside header
  page.drawText('PayGo Billing System', {
    x: 40,
    y: height - 50,
    size: 22,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  page.drawText('OFFICIAL PAYMENT RECEIPT / TO\'LOV CHEKI', {
    x: 40,
    y: height - 80,
    size: 11,
    font: helveticaFont,
    color: rgb(0.85, 0.92, 1),
  })

  // Status Badge
  page.drawRectangle({
    x: width - 170,
    y: height - 68,
    width: 130,
    height: 30,
    color: rgb(0.9, 0.98, 0.94),
    borderColor: rgb(0.08, 0.52, 0.35),
    borderWidth: 1,
  })

  page.drawText('PAID / TO\'LANDI', {
    x: width - 152,
    y: height - 57,
    size: 10,
    font: helveticaBold,
    color: rgb(0.08, 0.52, 0.35),
  })

  // Main Card Container
  page.drawRectangle({
    x: 40,
    y: height - 460,
    width: width - 80,
    height: 320,
    color: rgb(0.98, 0.98, 1),
    borderColor: rgb(0.88, 0.91, 0.96),
    borderWidth: 1,
  })

  let startY = height - 175

  const drawRow = (label: string, value: string, isBold = false) => {
    page.drawText(label, {
      x: 60,
      y: startY,
      size: 12,
      font: helveticaFont,
      color: rgb(0.39, 0.45, 0.55),
    })
    page.drawText(value, {
      x: 230,
      y: startY,
      size: 12,
      font: isBold ? helveticaBold : helveticaFont,
      color: rgb(0.08, 0.13, 0.22),
    })
    startY -= 32
  }

  drawRow('Tranzaksiya ID:', details.paymentId, true)
  drawRow('Xizmat / Tarif:', details.title, true)
  drawRow('To\'lov Summasi:', `${details.amount.toLocaleString('en-US')} UZS`, true)
  drawRow('Sana va Vaqt:', details.date)
  drawRow('Foydalanuvchi ID:', details.userId)
  drawRow('Qabul Qiluvchi Karta:', details.cardNumber)
  drawRow('Karta Egasi:', details.cardOwner)
  drawRow('To\'lov Holati:', 'Muvaffaqiyatli (Tasdiqlangan)')

  // Line Divider
  page.drawLine({
    start: { x: 60, y: startY + 12 },
    end: { x: width - 60, y: startY + 12 },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.93),
  })

  // Security Note
  page.drawText('Ushbu chek PayGo avtomatlashtirilgan to\'lov tizimi tomonidan shakllantirildi.', {
    x: 40,
    y: 80,
    size: 10,
    font: helveticaFont,
    color: rgb(0.5, 0.5, 0.5),
  })

  page.drawText('Murojaat va CRM Boshqaruv: https://paygo-pearl.vercel.app', {
    x: 40,
    y: 60,
    size: 10,
    font: helveticaFont,
    color: rgb(0.09, 0.41, 0.88),
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
