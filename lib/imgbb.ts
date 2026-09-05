export async function uploadToImgBB(imageInput: string | Buffer): Promise<string | null> {
  const apiKey = process.env.IMGBB_API_KEY
  if (!apiKey) {
    return null
  }

  try {
    let base64Data = ''
    if (Buffer.isBuffer(imageInput)) {
      base64Data = imageInput.toString('base64')
    } else if (typeof imageInput === 'string') {
      if (imageInput.startsWith('data:image')) {
        base64Data = imageInput.split(',')[1] || imageInput
      } else if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        const res = await fetch(imageInput)
        const buf = await res.arrayBuffer()
        base64Data = Buffer.from(buf).toString('base64')
      } else {
        base64Data = imageInput
      }
    }

    if (!base64Data) return null

    const formData = new FormData()
    formData.append('image', base64Data)

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    })

    const json = await response.json()
    if (json.success && (json.data?.url || json.data?.display_url)) {
      return json.data.url || json.data.display_url
    } else {
      console.warn('ImgBB upload error response:', json)
      return null
    }
  } catch (error) {
    console.error('ImgBB upload failed:', error)
    return null
  }
}
