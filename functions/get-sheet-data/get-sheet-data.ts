import { Handler } from "@netlify/functions";

type language = { name: string; count: number };
type server = { name: string; languages: language[] };
const callbackname = "callback";

function getApiUrl() {
  const documentId = "1wJiDGy77tOdV7ATqXj-bGXH7JmQo-sbjHrYJTcoI4Ow";
  const pageId = "1303305384";
  const tq = "select E, F, G";
  const url = `https://docs.google.com/spreadsheets/d/${documentId}/gviz/tq?tqx=out:json;responseHandler:${callbackname}&tq=${tq}&gid=${pageId}`;
  const encodedUrl = encodeURIComponent(url);
  return `https://api.allorigins.win/get?url=${encodedUrl}`;
}

function callback(data: any) {
  return data;
}

function convertToJson(data) {
  const outerJson = JSON.parse(data);
  const contents = outerJson.contents;
  const index = contents.indexOf(callbackname);
  const functionCall = contents.slice(index);
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

function parse(json: any): server[] {
  const servers: server[] = [];

  for (const row of json.table.rows) {
    const serverName = normalizeName(row.c[1].v);

    if (!isEuServer(serverName)) {
      continue;
    }

    const sizeName = row.c[0].v;
    const size = sizeName == "Small" ? 1 : sizeName == "Medium" ? 2 : 3;
    const languageName = normalizeName(row.c[2].v);

    let server = servers.find((s) => s.name == serverName);

    if (!server) {
      server = { name: serverName, languages: [] };
      servers.push(server);
    }

    let language = server.languages.find((l) => l.name == languageName);

    if (!language) {
      language = { name: languageName, count: 0 };
      server.languages.push(language);
    }

    language.count += size;
  }

  for (const server of servers) {
    server.languages = server.languages.sort((a, b) => b.count - a.count);
  }

  return servers;
}

export const handler: Handler = async (event, context) => {
  const { name = "stranger" } = event.queryStringParameters;

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Hello, ${name}!`,
    }),
  };
};
