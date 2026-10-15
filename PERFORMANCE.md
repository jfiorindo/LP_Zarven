# Validação de movimento — 15/10/2026

Comparação com a versão local imediatamente anterior à otimização de Canvas e
scroll. Chrome headless, janela de 1440 × 900 e 390 × 900, simulação de CPU 4×
mais lenta via DevTools. Após o carregamento, 240 passos de scroll percorreram
a página inteira, seguidos por um segundo para concluir as transições.

| Medida na execução principal | Desktop antes → depois | Janela estreita antes → depois |
| --- | --- | --- |
| JavaScript acumulado | 499,1 → 238,4 ms | 387,9 → 164,5 ms |
| Custo dos callbacks de animação, p95 | 5,6 → 0,5 ms | 2,4 → 0,4 ms |
| Intervalo entre frames, p95 | 19,7 → 17,7 ms | 11,7 → 8,9 ms |
| Tarefas longas acima de 50 ms | 0 → 0 | 0 → 0 |

O custo acumulado de JavaScript na execução principal caiu aproximadamente
52% no desktop e 58% na janela estreita. Parte do trabalho de desenho foi
transferida para um worker: isso libera a navegação, mas não elimina o custo
total de desenhar os modelos.

São amostras locais, não métricas de usuários reais nem garantia de FPS.
O teste não mede latência física de mouse/touch, e GPU, taxa de atualização,
carga do sistema e navegador influenciam a experiência. A janela estreita
não equivale a um celular físico.

O teste funcional `npm test` verifica Chrome em 320, 390, 768 e 1440 px,
animação automática, pausa/retomada, worker normal e bloqueado, renderer
alternativo, âncoras, FAQ, teclado, ausência de overflow, preferência de
movimento reduzido e ausência de loop JavaScript em repouso.

As otimizações não exigem novas bibliotecas de runtime.
