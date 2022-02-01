import { Handler } from "@netlify/functions";
import fetch from "cross-fetch";

type language = { name: string; count: number };
type server = { name: string; languages: language[] };
const callbackname = "googleSheetJsonParseCallback";

function getApiUrl() {
  const documentId = "1wJiDGy77tOdV7ATqXj-bGXH7JmQo-sbjHrYJTcoI4Ow";
  const pageId = "1303305384";
  const tq = "select E, F, G";
  const url = `https://docs.google.com/spreadsheets/d/${documentId}/gviz/tq?tqx=out:json;responseHandler:${callbackname}&tq=${tq}&gid=${pageId}`;
  return url;
}

function googleSheetJsonParseCallback(data: any) {
  return data;
}

function convertToSheetTable(data: string) {
  const index = data.indexOf(callbackname);
  const functionCall = data.slice(index);
  return eval(functionCall);
}

function isEuServer(serverName: string): boolean {
  const euServers = [
    "Neria",
    "Kadan",
    "Trixion",
    "Calvasus",
    "Thirain",
    "Zinnervale",
    "Asta",
    "Wei",
    "Slen",
  ];
  return euServers.includes(serverName);
}

function normalizeName(name: string): string {
  if (name) {
    name = name.trim();
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}

function parseLanguage(languageText: string): string[] {
  languageText = normalizeName(languageText);
  if (!languageText) {
    return [];
  }

  languageText = translateLanugageName(languageText);

  const languages = languageText.split("/");

  return languages.map((l) => translateLanugageName(l)).filter((l) => !!l);
}

const languageTranslations = {
  "Czech/Slovak": "Czech-Slovak",
  "Croatian/Serbian/Bosnian/Slovenian": "Serbo-Croatian",
  Croatian: "Serbo-Croatian",
  "Serbian/Croatian": "Serbo-Croatian",
  Balkan: "Serbo-Croatian",
  Multicultural: "",
  SwissGerman: "",
};

function translateLanugageName(l: string) {
  l = normalizeName(l);
  l = l.replace("Mostly ", "");
  l = l.replace(" (Streamer)", "");
  l = l.replace("Streamer (", "");
  l = l.replace(")", "");

  return languageTranslations[l] ?? l;
}

function parse(sheetTable: any): server[] {
  const servers: server[] = [];

  for (const row of sheetTable.table.rows) {
    const serverName = normalizeName(row.c[1].v);

    if (!isEuServer(serverName)) {
      continue;
    }

    const sizeName = row.c[0].v;
    const size = sizeName == "Small" ? 1 : sizeName == "Medium" ? 2 : 3;
    const rawLanguageName = normalizeName(row.c[2].v);

    let server = servers.find((s) => s.name == serverName);

    if (!server) {
      server = { name: serverName, languages: [] };
      servers.push(server);
    }

    const languageNames = parseLanguage(rawLanguageName);

    const count = size / languageNames.length;

    for (const languageName of languageNames) {
      let language = server.languages.find((l) => l.name == languageName);

      if (!language) {
        language = { name: languageName, count: 0 };
        server.languages.push(language);
      }

      language.count += size;
    }
  }

  for (const server of servers) {
    for (const language of server.languages) {
      language.count = Math.ceil(language.count);
    }
    server.languages = server.languages.filter((l) => l.count > 1);
    server.languages = server.languages.sort((a, b) => {
      const countCompare = b.count - a.count;
      if (countCompare == 0) {
        return a.name.localeCompare(b.name);
      }
      return countCompare;
    });
  }

  return servers;
}

export const handler: Handler = async (_event, _context) => {
  const apiUrl = getApiUrl();

  try {
    const response = await fetch(apiUrl);
    const responseText = await response.text();
    const sheetTable = convertToSheetTable(responseText);
    const servers = parse(sheetTable);
    return {
      statusCode: 200,
      body: JSON.stringify(servers),
    };
  } catch (e) {
    console.log(e);
    return {
      statusCode: 500,
      body: JSON.stringify(e),
    };
  }
};
