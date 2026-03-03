
export interface Declaration {
  date: string;
  etablissement: string;
  etablissement_id: string;
  status: string;
  cases: any[];
}

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "";

export const googleSheetsService = {
  async saveDeclaration(declaration: Declaration) {
    if (!SCRIPT_URL) {
      console.warn("URL Google Script non configurée. Sauvegarde locale uniquement.");
      return false;
    }
    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", // Nécessaire pour Google Apps Script
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(declaration),
      });
      return true;
    } catch (error) {
      console.error("Erreur Google Sheets:", error);
      return false;
    }
  },

  async getDeclarations(): Promise<Declaration[]> {
    if (!SCRIPT_URL) return [];
    try {
      const response = await fetch(SCRIPT_URL);
      return await response.json();
    } catch (error) {
      console.error("Erreur lecture Google Sheets:", error);
      return [];
    }
  }
};
