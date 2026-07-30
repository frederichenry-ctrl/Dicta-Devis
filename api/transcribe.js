import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Clé OPENAI_API_KEY non détectée sur Vercel." });
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Fichier audio vide.' });
    }

    const file = new File([buffer], 'audio.webm', { type: 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'fr',
    });

    if (!transcription.text) {
      return res.status(400).json({ error: "Aucune parole détectée." });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant comptable BTP. Extrais les prestations sous forme de JSON strict :
          {
            "clientName": "Nom du client ou Inconnu",
            "items": [
              {
                "designation": "Description prestation",
                "quantite": 1,
                "prix": 100,
                "tva": 10
              }
            ]
          }`
        },
        { role: 'user', content: transcription.text }
      ]
    });

    const structuredData = JSON.parse(completion.choices[0].message.content);

    return res.status(200).json({
      success: true,
      rawText: transcription.text,
      data: structuredData
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Erreur Serveur', 
      details: error.message || String(error)
    });
  }
}
