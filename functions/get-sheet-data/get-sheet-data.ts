import fetch from "cross-fetch";

export async function handler(_event, _context) {
  const apiUrl = getApiUrl();

  try {
    const response = await fetch(apiUrl);
    const responseText = await response.text();
    const sheetTable = convertToSheetTable(responseText);
    console.log(sheetTable);
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
}

type language = { name: string; count: number };
type server = { name: string; total: number; languages: language[] };
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
  console.log(functionCall);
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

const serboCroatian = "Serbo-Croatian";
const czechSlovak = "Czech-Slovak";
const german = "German";
const turkish = "Turkish";

const languageTranslations = {
  ["Czech/Slovak"]: czechSlovak,
  ["Czech and Slovak"]: czechSlovak,
  ["Czech"]: czechSlovak,
  ["Croatian/Serbian/Bosnian/Slovenian"]: serboCroatian,
  ["Croatian"]: serboCroatian,
  ["Serbian/Croatian"]: serboCroatian,
  ["Balkan (Serb, Cro, MN, Bos)"]: serboCroatian,
  ["Balkan"]: serboCroatian,
  ["Serbian"]: serboCroatian,
  ["Multicultural"]: "International",
  ["SwissGerman"]: german,
  ["Swiss-German"]: german,
  ["Deutsch"]: german,
  ["Germany"]: german,
  ["Streamer (Turkish)"]: turkish,
  ["Turkish (Streamer)"]: turkish,
  ["Mostly Korean"]: "Korean",
  ["Français"]: "French",
  ["Arab"]: "Arabic",
  ["Spannish"]: "Spanish",
  ["Scandinavian"]: "Nordic",
};

function translateLanugageName(l: string) {
  l = normalizeName(l);

  return languageTranslations[l] ?? l;
}

function parse(sheetTable: any): server[] {
  console.log(sheetTable);
  const servers: server[] = [];

  for (const row of sheetTable.table.rows) {
    if (!row.c || !row.c || row.c.length < 1) {
      continue;
    }

    if (!row.c[1]) {
      continue;
    }

    const serverName = normalizeName(row.c[1].v);
    if (!serverName) {
      continue;
    }
    console.log(serverName);

    if (!isEuServer(serverName)) {
      continue;
    }

    console.log(row);
    console.log(row.c[0]);

    try {
      if (row.c[0]) {
        const sizeName = row.c[0].v;
        const size = sizeName == "Small" ? 1 : sizeName == "Medium" ? 2 : 3;
        const rawLanguageName = normalizeName(row.c[2].v);

        if (rawLanguageName !== "Null") {
          let server = servers.find((s) => s.name == serverName);

          if (!server) {
            server = { name: serverName, total: 0, languages: [] };
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

            language.count += count;
            server.total += count;
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  for (const server of servers) {
    for (const language of server.languages) {
      language.count = Math.ceil(language.count);
    }
    server.languages = server.languages.sort((a, b) => {
      const countCompare = b.count - a.count;
      if (countCompare == 0) {
        return a.name.localeCompare(b.name);
      }
      return countCompare;
    });
  }

  return servers.sort((a, b) => b.total - a.total);
}
