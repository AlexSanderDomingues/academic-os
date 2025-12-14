Serverless AVA (exemplo)
=========================

Este repositório contém um exemplo de função serverless em `api/ava.ts` que atua como um proxy para um LLM (ex.: OpenAI). A função espera receber POSTs com JSON { mode, payload } e retorna { result } com a resposta do modelo.

Como usar
---------

1. Escolha um provedor serverless (recomendado: Vercel para deploy simples)

2. Configure a variável de ambiente `OPENAI_API_KEY` no painel do provedor (não a coloque no código).

3. Deploy
   - Vercel: `vercel --prod` (instale o Vercel CLI e logue)
   - Netlify: crie uma function equivalente em `netlify/functions/ava.js`

4. Requisições do front-end

   A API expõe um endpoint POST `/api/ava`. Exemplo de corpo:

   {
     "mode": "generateQuestions",
     "payload": { "text": "seu texto de anotação aqui" }
   }

Resposta:

  { "result": "texto retornado pelo LLM" }

Desenvolvimento local
---------------------

Você pode testar localmente com o Vercel CLI:

```sh
npx vercel dev
```

ou usando `node`/`fetch` apontando para http://localhost:3000/api/ava após iniciar o dev server.

Segurança
--------

- Nunca comite chaves de API.
- Restrinja uso do endpoint (rate-limit) e adicione autenticação se for público.

Adaptação para outros provedores
--------------------------------

- AWS Lambda: embrulhe o handler adaptando `event`/`context`.
- Google Cloud Functions: similar.
