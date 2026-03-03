import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

const getAi = () => {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "") {
      throw new Error("Clé API Gemini manquante. Veuillez configurer GEMINI_API_KEY.");
    }
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
};

export interface CaseData {
  sex: "M" | "F";
  ageGroup: "0-4 ans" | "5-14 ans" | "15-24 ans" | "25-44 ans" | "45-64 ans" | "plus de 65 ans";
  pathology: "Varicelle" | "Syndrome grippaux" | "Diarrhée aiguë" | "IRA";
  symptoms: string[];
}

export async function analyzeDeclarationImage(base64Image: string): Promise<CaseData[]> {
  const ai = getAi();
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyse cette fiche de déclaration de santé. 
  Extrais les informations pour chaque cas listé sur la fiche.
  Les pathologies possibles sont: Varicelle, Syndrome grippaux, Diarrhée aiguë, IRA.
  Les tranches d'âge sont: 0-4 ans, 5-14 ans, 15-24 ans, 25-44 ans, 45-64 ans, plus de 65 ans.
  Le sexe est M ou F.
  
  CONSIGNES STRICTES :
  1. Si aucune case n'est cochée à côté d'une pathologie, ne crée aucun cas.
  2. Si la fiche est totalement vide ou ne contient que des informations pré-imprimées sans marques manuscrites, retourne impérativement un tableau vide [].
  3. Ne devine jamais d'informations. Si c'est ambigu, ne crée pas le cas.
  
  Retourne une liste d'objets JSON.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sex: { type: Type.STRING, enum: ["M", "F"] },
            ageGroup: { type: Type.STRING, enum: ["0-4 ans", "5-14 ans", "15-24 ans", "25-44 ans", "45-64 ans", "plus de 65 ans"] },
            pathology: { type: Type.STRING, enum: ["Varicelle", "Syndrome grippaux", "Diarrhée aiguë", "IRA"] },
            symptoms: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
          },
          required: ["sex", "ageGroup", "pathology", "symptoms"],
        },
      },
    },
  });

  console.log("AI Response:", response.text);

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
}
