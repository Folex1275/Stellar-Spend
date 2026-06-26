import { graphql, parse, validate } from "graphql";
import { schema } from "@/lib/graphql/schema";
import { resolvers } from "@/lib/graphql/resolvers";
import { buildContext } from "@/lib/graphql/context";

const PLAYGROUND_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>GraphQL Playground</title>
  <meta charset=utf-8/>
  <meta name="viewport" content="user-scalable=no, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, minimal-ui">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css"/>
  <link rel="shortcut icon" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/favicon.png"/>
  <script src="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    window.addEventListener('load', function() {
      GraphQLPlayground.init(document.getElementById('root'), {
        endpoint: '/api/graphql',
        settings: { 'editor.theme': 'dark' }
      });
    });
  </script>
</body>
</html>`;

export async function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return new Response(PLAYGROUND_HTML, {
      headers: { "Content-Type": "text/html" },
    });
  }
  return new Response(JSON.stringify({ message: "GraphQL endpoint. Use POST." }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  let body: { query?: string; variables?: Record<string, unknown>; operationName?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ errors: [{ message: "Invalid JSON body" }] }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { query, variables, operationName } = body;

  if (!query) {
    return new Response(JSON.stringify({ errors: [{ message: "Missing query" }] }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse and validate
  let document;
  try {
    document = parse(query);
  } catch (err) {
    return new Response(
      JSON.stringify({ errors: [{ message: `Parse error: ${(err as Error).message}` }] }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    return new Response(JSON.stringify({ errors: validationErrors }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const context = buildContext(request);

  const result = await graphql({
    schema,
    source: query,
    rootValue: resolvers,
    contextValue: context,
    variableValues: variables,
    operationName,
  });

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
}
