````markdown
Serverless AVA (removido)
=========================

A integração serverless / LLM que existia como exemplo foi removida a pedido do usuário.

Se você quiser reativar um endpoint serverless no futuro, siga estas recomendações:

- Não inclua chaves no repositório; use variáveis de ambiente no provedor (Vercel, Netlify, etc.).
- Valide e sanitize todo input recebido para evitar vazamento de dados sensíveis.
- Adicione um fluxo de consentimento claro no frontend antes de enviar notas pessoais ao servidor.
- Proteja o endpoint com autenticação e limite de taxa (rate limiting).

Exemplo de alto nível (não implementado aqui):

```js
// POST /api/ava
// body: { mode: 'explain', payload: { text: '...' } }
// header: Authorization: Bearer <TOKEN_ENV_SET_ON_SERVER>
```

Por enquanto o projeto mantém apenas implementações locais (heurísticas) para recursos de assistente.
````
