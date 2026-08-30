export const patch = `
  if (text === 'Tarix' || text === '📜 Tarix') {
    const userPayments = await db.select().from(payments).where(eq(payments.userId, userIdStr)).orderBy(desc(payments.createdAt)).limit(5)
    if (!userPayments.length) {
      await send(token, chatId, '📭 Hozircha to‘lovlar tarixi bo‘sh.', menu)
      return NextResponse.json({ ok: true })
    }
    
    let historyText = '📜 <b>So‘nggi 5 ta to‘lov tarixi:</b>\\n\\n'
    for (const p of userPayments) {
      const statusIcon = p.status === 'paid' ? '✅' : (p.status === 'pending' ? '⏳' : '❌')
      const typeLabel = p.isTest ? '🧪 Test' : '💳 Real'
      const dt = new Date(p.createdAt).toLocaleString('uz-UZ')
      historyText += \`\${statusIcon} <b>\${p.amount.toLocaleString()} UZS</b> (\${typeLabel})\\n📅 \${dt}\\n🆔 \` + \`<code>\${p.id}</code>\\n\\n\`
    }
    historyText += '<i>To‘liq tarixni Veb CRM panelida ko‘rishingiz mumkin.</i>'
    await send(token, chatId, historyText, menu)
    return NextResponse.json({ ok: true })
  }

  if (text === 'Qoidalar' || text === '⚖️ Qoidalar') {
    await send(
      token,
      chatId,
      \`⚖️ <b>PayGo Tizimi Qoidalari:</b>\\n\\n\` +
      \`1️⃣ <b>Cheklovlar:</b>\\n\` +
      \`- Bepul tarifda <b>1 ta do‘kon</b> ochish mumkin.\\n\` +
      \`- Bepul tarifda <b>kuniga max 10 ta</b> va <b>umrbod max 50 ta</b> to‘lov qabul qilinadi.\\n\\n\` +
      \`2️⃣ <b>Premium Tarif:</b>\\n\` +
      \`- Cheklovlarni olib tashlash uchun <b>"💎 Tariflar"</b> bo‘limidan o‘zingizga qulay paketni faollashtiring.\\n\\n\` +
      \`3️⃣ <b>Userbot Xavfsizligi:</b>\\n\` +
      \`- Sizning API ID/Hash va sesiyalar shifrlangan holda faqat to‘lovlarni monitoring qilish uchun ishlatiladi.\\n\\n\` +
      \`4️⃣ <b>To‘lovlar (Real/Test):</b>\\n\` +
      \`- Bot ichidan ochilgan to‘lovlar "Test" hisoblanadi.\\n\` +
      \`- API orqali (do‘kon saytidan) yaratilgan to‘lovlar "Real" hisoblanadi va limitdan yechiladi.\\n\\n\` +
      \`Savollar va yordam uchun admin bilan bog‘laning.\`,
      menu
    )
    return NextResponse.json({ ok: true })
  }
`
