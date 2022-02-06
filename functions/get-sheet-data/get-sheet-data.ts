import fetch from "cross-fetch";

type sheet = { table: table };
type table = { rows: row[] };
type row = { c: cell[] };
type cell = { v: string | undefined };

type server = { name: string; total: number; languages: language[] };
type language = { name: string; count: number };

export async function handler(event, _context) {
  const region = event.queryStringParameters.region ?? "eu";
  console.log(region);

  const apiUrl = getApiUrl();

  try {
    const response = await fetch(apiUrl);
    const responseText = await response.text();
    const sheet = convertToSheet(responseText);
    const servers = parse(sheet, region);
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

function convertToSheet(data: string) {
  if (!data) {
    throw "Invalid response from the Google API";
  }
  const index = data.indexOf(callbackname);
  if (index < 0 || data.length < callbackname.length) {
    throw "Invalid response from the Google API";
  }
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

function parse(sheet: sheet, region: string): server[] {
  const servers: server[] = [];

  if (!sheet?.table?.rows) {
    return servers;
  }

  for (const row of sheet.table.rows) {
    if (!row.c || row.c.length < 3) {
      continue;
    }

    const serverName = parseServerName(row);
    if (!serverName) {
      continue;
    }

    if (
      (region == "eu" && !isEuServer(serverName)) ||
      (region == "na" && isEuServer(serverName))
    ) {
      continue;
    }

    const size = parseGuildSize(row);
    const languageNames = parseLanguage(row);

    if (languageNames.length == 0) {
      continue;
    }

    let server = servers.find((s) => s.name == serverName);

    if (!server) {
      server = { name: serverName, total: 0, languages: [] };
      servers.push(server);
    }

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

  for (const server of servers) {
    server.total = Math.ceil(server.total);

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

function parseServerName(row: row): string | undefined {
  if (!row.c || row.c.length < 2 || !row.c[1].v) {
    return undefined;
  }

  const rawServerName = row.c[1].v;
  return normalizeName(rawServerName);
}

function parseGuildSize(row: row): number | undefined {
  if (!row.c || row.c.length < 1 || !row.c[0].v) {
    return undefined;
  }

  const sizeName = row.c[0].v;
  const size = sizeName == "Large" ? 3 : sizeName == "Medium" ? 2 : 1;

  return size;
}

function parseLanguage(row: row): string[] {
  if (!row.c || row.c.length < 3 || !row.c[2].v) {
    return undefined;
  }
  const rawLanguageName = normalizeName(row.c[2].v);

  if (!rawLanguageName || rawLanguageName == "Null") {
    return [];
  }

  var languageText = normalizeName(rawLanguageName);
  if (!languageText) {
    return [];
  }

  languageText = translateLanguageName(languageText);

  const languages = languageText.split("/");

  return languages.map((l) => translateLanguageName(l)).filter((l) => !!l);
}

const serboCroatian = "Serbo-Croatian";
const czechSlovak = "Czech-Slovak";
const german = "German";
const turkish = "Turkish";
const portuguese = "Portuguese";
const spanish = "Spanish";
const english = "English";

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
  ["Korean :)"]: "Korean",
  ["Français"]: "French",
  ["Arab"]: "Arabic",
  ["Spannish"]: spanish,
  ["Scandinavian"]: "Nordic",
  ["English (Primary) Filipino (Secondary)"]: "English/Filipino",
  ["Português"]: portuguese,
  ["Portugués"]: portuguese,
  ["Brasil"]: portuguese,
  ["Brazilian"]: portuguese,
  ["Español"]: spanish,
  ["English Only"]: english,
  ["Engish"]: english,
};

function translateLanguageName(l: string): string {
  l = normalizeName(l);

  return languageTranslations[l] ?? l;
}
