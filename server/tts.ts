import { GoogleGenAI } from '@google/genai';

const ALLOWED_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'] as const;
export type TtsVoiceName = (typeof ALLOWED_VOICES)[number];

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function generateSpeechBriefing(params: {
  text: string;
  voiceName?: string;
  style?: string;
  mode?: 'single' | 'dispatch_dialogue';
  secondaryText?: string;
}): Promise<{ audioBase64: string; mimeType: string }> {
  const ai = getGeminiClient();
  const chosenVoice: TtsVoiceName = ALLOWED_VOICES.includes(params.voiceName as TtsVoiceName)
    ? (params.voiceName as TtsVoiceName)
    : 'Kore';

  if (params.mode === 'dispatch_dialogue' && params.secondaryText) {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Dispatch Lead: ${params.text}`,
              speechMetadata: {
                speaker: 'Dispatch Lead',
                style: params.style || 'Clear, calm logistics operations director',
              },
            },
            {
              text: `Fleet Coordinator: ${params.secondaryText}`,
              speechMetadata: {
                speaker: 'Fleet Coordinator',
                style: 'Crisp, attentive transport coordinator confirming details',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: 'Dispatch Lead',
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: chosenVoice },
                },
              },
              {
                speaker: 'Fleet Coordinator',
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: chosenVoice === 'Kore' ? 'Puck' : 'Kore' },
                },
              },
            ],
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = part?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Speech synthesis returned empty audio payload.');
    }
    return {
      audioBase64: base64Audio,
      mimeType: part?.inlineData?.mimeType || 'audio/wav',
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: params.text,
            speechMetadata: {
              style:
                params.style ||
                'Clear, authoritative, measured transport dispatch briefing',
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: chosenVoice },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  const base64Audio = part?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('Speech synthesis returned empty audio payload.');
  }

  return {
    audioBase64: base64Audio,
    mimeType: part?.inlineData?.mimeType || 'audio/wav',
  };
}
