# Zarven — landing page

Página estática em HTML, CSS e JavaScript, sem framework ou dependências de runtime.
As fontes Manrope e DM Mono continuam carregadas pelo Google Fonts.

## Desenvolvimento e validação

Requer Node.js 20.19+.

```sh
npm ci
npm run lint
npm run build
npm test
```

O lint usa ESLint para JavaScript e Stylelint para CSS, incluindo o estilo inline do HTML.
O build copia a página e os assets referenciados para `dist/`, mantendo
`zarven-landing-page.html` e oferecendo também `index.html` como entrada estática.
Não há alteração de URLs, conteúdo ou metadados no build.

Os testes usam Playwright com Chrome instalado, em modo headless, e iniciam/encerram
um servidor local automaticamente. Para Edge, defina `BROWSER_CHANNEL=msedge`.
Cobrem 320, 390, 768 e 1440 px, navegação, FAQ, pausa, movimento reduzido,
conteúdo sem JavaScript e ausência de loops de animação JS em repouso.
Capturas locais ficam em `.qa/` (não versionada).

Com o servidor local ativo em `http://localhost:3000`, `npm run profile` repete
a amostra de scroll com CPU 4× mais lenta e grava `.qa/motion-profile.json`.
Use `PREVIEW_URL` para outra URL. Veja a comparação e as limitações do teste em
[PERFORMANCE.md](PERFORMANCE.md).

## Movimento

- `effects.css` e `effects.js`: Hero com fade/stagger, entradas únicas via
  IntersectionObserver, hover/foco e progresso de scroll por CSS Scroll Timeline,
  com eventos passivos como alternativa para navegadores sem suporte.
- `scroll-models.js`: controle dos modelos, geometria de layout em cache,
  resolução limitada e desenho sob demanda apenas quando visíveis.
- `model-renderer.js` e `model-worker.js`: desenho via OffscreenCanvas em um
  worker. Há no máximo um lote em processamento; posições recentes substituem
  as antigas, evitando filas durante scroll rápido. O mesmo renderer funciona
  na execução principal quando o recurso não existe ou o worker é bloqueado.
- `prefers-reduced-motion` desativa entradas e transições e mostra modelos estáticos,
  inclusive quando a preferência muda com a página aberta.
- As animações começam ativas a cada visita; o botão pausa somente a página atual.
  O modelo da Hero flutua suavemente por CSS sem redesenhar o Canvas em repouso.
  O botão também pausa esse movimento e os demais loops CSS.
- Scroll e âncoras usam o comportamento nativo do navegador.

Entradas duram 900–1000 ms, com deslocamentos de 6–10 px. A flutuação da Hero
leva 12 segundos por ciclo. Sem blur no cabeçalho fixo, bibliotecas adicionais,
loops JavaScript em repouso ou `will-change` aplicado indiscriminadamente.

Referências técnicas usadas:
- [Animações de alto desempenho — web.dev](https://web.dev/articles/animations-guide)
- [CSS Scroll Timeline — Chrome](https://developer.chrome.com/blog/scroll-animation-performance-case-study)
- [OffscreenCanvas — MDN](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)

As cores, fontes, textos, metadados e links originais foram preservados.

## Vercel

O `vercel.json` já define o projeto como estático, executa `npm run build` e
publica a pasta `dist`. Importe a raiz deste repositório na Vercel; ela instalará
as dependências durante o deploy. A página inicial fica em `/` graças ao
`dist/index.html` produzido pelo build. Faça commit e envie também
`model-renderer.js`, `model-worker.js`, `scripts/build.mjs`, `package.json`,
`package-lock.json`, `vercel.json` e os assets originais. A pasta `dist` é gerada
no deploy e não precisa ser enviada ao Git.
