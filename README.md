# Dados Gráficos — Extensão do Simplex System Backend

Extensão desenvolvida em TypeScript para o projeto da disciplina de Pesquisa Operacional.

O objetivo desta extensão é enriquecer a resposta da API com dados matemáticos estruturados que permitam ao frontend construir a visualização gráfica do problema de Programação Linear resolvido pelo Método Simplex.

O backend não gera imagens nem gráficos. Sua responsabilidade é exclusivamente calcular e fornecer os dados necessários para que o frontend realize a renderização.

---

## Tecnologias Utilizadas

* Node.js
* TypeScript
* AdonisJS 6
* Git
* GitHub

---

## O que foi alterado

### Arquivos modificados

#### `app/services/simplex_service.ts`

Adicionada a exportação do tipo `SimplexResult` ao final do arquivo:

```typescript
export type SimplexResult = ReturnType<SimplexService['solve']>
```

Nenhuma lógica foi alterada.

#### `app/controllers/simplex_controller.ts`

Adicionadas as seguintes mudanças:

* Importação do novo `GraphService`;
* Chamada ao `GraphService` após a resolução algébrica;
* Inclusão do campo `graphData` no objeto de resposta.

Nenhuma validação existente foi modificada. A lógica de resolução algébrica permanece intacta.

---

### Arquivo adicionado

#### `app/services/graph_service.ts`

Novo serviço responsável por todos os cálculos matemáticos necessários para a visualização gráfica. Não possui dependência do AdonisJS nem do `SimplexService`.

---

## Estrutura do Projeto Atualizada

```txt
start/routes.ts
        ↓
app/controllers/simplex_controller.ts
        ↓                    ↓
app/services/         app/services/
simplex_service.ts    graph_service.ts
```

---

## Responsabilidades do Novo Arquivo

#### `graph_service.ts`

Responsável por:

* Verificar se o problema possui exatamente 2 variáveis de decisão;
* Calcular os interceptos de cada restrição com os eixos coordenados;
* Enumerar todos os vértices da região viável por interseção de pares de restrições;
* Filtrar pontos inviáveis e deduplicar pontos numericamente próximos;
* Ordenar os vértices em sentido anti-horário para fechamento do polígono;
* Calcular as curvas de nível da função objetivo;
* Identificar o vértice correspondente ao ponto ótimo;
* Calcular os limites sugeridos para o canvas do frontend.

---

## Limitação do Método Gráfico

O método gráfico está disponível apenas para problemas com exatamente **2 variáveis de decisão**.

Quando o problema possuir outro número de variáveis, a resolução algébrica ocorre normalmente e o campo `graphData` retorna:

```json
{
  "available": false,
  "unavailableReason": "O método gráfico está disponível apenas para problemas com 2 variáveis de decisão. Este problema possui 3 variáveis."
}
```

---

## Separação de Responsabilidades

| Responsabilidade | Onde fica |
| ---------------- | --------- |
| Resolver o problema (Simplex) | `SimplexService` — sem alterações |
| Calcular dados matemáticos para o gráfico | `GraphService` — novo serviço |
| Orquestrar chamadas e montar resposta | `SimplexController` — adaptação mínima |
| Renderizar o gráfico | Frontend |
| Determinar escala visual, cores e animações | Frontend |

---

## Fluxo Completo de Execução

```txt
POST /simplex/solve
        ↓
SimplexController valida body
        ↓
SimplexService.createInitialTableau(...)
        ↓
SimplexService.solve(tableau)
        ↓
SimplexService.extractSolution(...)
SimplexService.hasMultipleOptimalSolutions(...)
        ↓
GraphService.compute(...)
  ├── Verifica número de variáveis
  ├── Calcula interceptos das restrições
  ├── Enumera e filtra vértices da região viável
  ├── Ordena vértices (sentido anti-horário)
  ├── Calcula curvas de nível
  ├── Identifica vértice ótimo
  └── Calcula viewport
        ↓
response.ok({ ...dadosAlgébricos, graphData })
```

---

## Dados Retornados em `graphData`

### Quando disponível (`available: true`)

| Campo | Descrição |
| ----- | --------- |
| `viewport.xMax` | Limite sugerido do eixo x para o canvas do frontend |
| `viewport.yMax` | Limite sugerido do eixo y para o canvas do frontend |
| `constraints[i].interceptX1` | Ponto onde a reta da restrição cruza o eixo x2 = 0 |
| `constraints[i].interceptX2` | Ponto onde a reta da restrição cruza o eixo x1 = 0 |
| `constraints[i].validSide` | Indica que o semiplano válido contém a origem |
| `feasibleRegion.vertices` | Lista de vértices do polígono convexo com coordenadas |
| `feasibleRegion.polygon` | Sequência de IDs dos vértices em sentido anti-horário |
| `objectiveFunction.levelCurves` | Valores de Z pré-calculados para retas paralelas |
| `optimalPoint.x1` | Coordenada x1 do ponto ótimo |
| `optimalPoint.x2` | Coordenada x2 do ponto ótimo |
| `optimalPoint.optimalValue` | Valor ótimo da função objetivo |
| `optimalPoint.vertexId` | Referência ao vértice da região viável correspondente ao ótimo |

---

## Exemplo de Requisição

```json
{
  "objective": [3, 5],
  "constraints": [
    [1, 0],
    [0, 2],
    [3, 2]
  ],
  "rhs": [4, 12, 18],
  "type": "max"
}
```

---

## Exemplo de Resposta

```json
{
  "message": "Simplex executado com sucesso",
  "data": {
    "status": "optimal",
    "solution": [2, 6],
    "optimalValue": 36,
    "hasMultipleSolutions": false,
    "iterationsCount": 2,

    "graphData": {
      "available": true,

      "viewport": {
        "xMax": 6.6,
        "yMax": 9.9
      },

      "constraints": [
        {
          "index": 0,
          "coefficients": [1, 0],
          "rhs": 4,
          "interceptX1": { "x1": 4.0, "x2": 0.0 },
          "interceptX2": null,
          "validSide": "origin"
        },
        {
          "index": 1,
          "coefficients": [0, 2],
          "rhs": 12,
          "interceptX1": null,
          "interceptX2": { "x1": 0.0, "x2": 6.0 },
          "validSide": "origin"
        },
        {
          "index": 2,
          "coefficients": [3, 2],
          "rhs": 18,
          "interceptX1": { "x1": 6.0, "x2": 0.0 },
          "interceptX2": { "x1": 0.0, "x2": 9.0 },
          "validSide": "origin"
        }
      ],

      "feasibleRegion": {
        "vertices": [
          { "id": "v0", "x1": 0.0, "x2": 0.0 },
          { "id": "v1", "x1": 4.0, "x2": 0.0 },
          { "id": "v2", "x1": 4.0, "x2": 3.0 },
          { "id": "v3", "x1": 2.0, "x2": 6.0 },
          { "id": "v4", "x1": 0.0, "x2": 6.0 }
        ],
        "polygon": ["v0", "v1", "v2", "v3", "v4"]
      },

      "objectiveFunction": {
        "coefficients": [3, 5],
        "type": "max",
        "levelCurves": [
          { "z": 0,  "label": "Z = 0"  },
          { "z": 9,  "label": "Z = 9"  },
          { "z": 18, "label": "Z = 18" },
          { "z": 27, "label": "Z = 27" },
          { "z": 36, "label": "Z = 36" }
        ]
      },

      "optimalPoint": {
        "x1": 2.0,
        "x2": 6.0,
        "optimalValue": 36,
        "vertexId": "v3"
      }
    }
  }
}
```

---

## Estado Atual do Desenvolvimento

### Implementado

* Cálculo de interceptos de cada restrição com os eixos coordenados;
* Enumeração completa dos vértices da região viável;
* Filtragem de pontos inviáveis e deduplicação numérica;
* Ordenação dos vértices em sentido anti-horário;
* Cálculo de curvas de nível da função objetivo;
* Identificação do vértice correspondente ao ponto ótimo;
* Cálculo dos limites do viewport com margem;
* Resposta estruturada para problemas com mais de 2 variáveis.

### Em Desenvolvimento

* Suporte a restrições do tipo `>=` e `=` na construção da região viável;
* Detecção e representação gráfica de regiões ilimitadas;
* Dados gráficos para o método Branch and Bound.

---

## Branches do Projeto

### main

Versão base do backend com o Método Simplex Tabular.

### simplex-loop

Branch funcional contendo a implementação do Método Simplex utilizada para testes e integração com o frontend.

### integrate-colleague-simplex

Branch experimental destinada à integração de arquitetura mais avançada com suporte futuro a Forma Padrão, Método Big M e restrições `>=` e `=`.

### branch-and-bound

Branch contendo a implementação do método Branch and Bound para resolução de problemas de Programação Linear Inteira.

### solucao-grafica *(novo)*

Branch contendo a extensão de dados gráficos para visualização da região viável, função objetivo e ponto ótimo.

---

## Repositório

https://github.com/SamuelNascimentoFocas/simplex-system-backend

---

## Autores

Projeto desenvolvido para a disciplina de Pesquisa Operacional.

Equipe responsável pelo desenvolvimento do sistema Simplex, da extensão Branch and Bound e da extensão de dados gráficos.