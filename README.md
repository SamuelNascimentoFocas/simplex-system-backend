# Endpoint de Programação Linear Inteira — Integração do Branch and Bound à API

Extensão desenvolvida em TypeScript para o projeto da disciplina de Pesquisa Operacional.

O objetivo desta extensão é expor o módulo de Branch and Bound já implementado através de um endpoint REST, permitindo a resolução de problemas de Programação Linear Inteira via API.

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

#### `package.json`

Adicionado o alias de importação do módulo Branch and Bound:

```json
{
  "imports": {
    "#controllers/*": "./app/controllers/*.js",
    "#services/*": "./app/services/*.js",
    "#branch_and_bound/*": "./app/branch_and_bound/*.js"
  }
}
```

Sem essa entrada, o TypeScript e o Node.js não conseguem resolver o caminho `#branch_and_bound/index` utilizado pelo novo controller.

#### `start/routes.ts`

Adicionada a rota do novo endpoint mantendo a rota original intacta:

```typescript
import router from '@adonisjs/core/services/router'

const SimplexController = () => import('#controllers/simplex_controller')
const BranchAndBoundController = () => import('#controllers/branch_and_bound_controller')

router.post('/simplex/solve', [SimplexController, 'solve'])
router.post('/simplex/solve-integer', [BranchAndBoundController, 'solve'])
```

---

### Arquivo adicionado

#### `app/controllers/branch_and_bound_controller.ts`

Controller responsável por receber requisições de resolução inteira, validar os dados de entrada e acionar o `BranchAndBoundSolver`.

Segue o mesmo padrão de validação do `SimplexController`:

* validação da função objetivo;
* validação das restrições (formato, coeficientes, operador, rhs);
* validação do tipo do problema.

O contrato de entrada é idêntico ao endpoint `/simplex/solve`, permitindo que o frontend envie o mesmo corpo de requisição para ambos os endpoints.

---

## Estrutura do Projeto Atualizada

```txt
start/
└── routes.ts                          ← rota adicionada

app/
├── controllers/
│   ├── simplex_controller.ts          ← sem alterações
│   └── branch_and_bound_controller.ts ← novo
│
├── services/
│   ├── simplex_service.ts             ← sem alterações
│   └── graph_service.ts               ← sem alterações
│
└── branch_and_bound/
    ├── BranchAndBoundSolver.ts        ← sem alterações
    ├── BranchNode.ts                  ← sem alterações
    ├── types.ts                       ← sem alterações
    └── index.ts                       ← sem alterações
```

---

## Endpoints Disponíveis

### Resolver problema contínuo (Simplex)

```http
POST /simplex/solve
```

### Resolver problema inteiro (Branch and Bound)

```http
POST /simplex/solve-integer
```

### URL Local

```txt
http://localhost:3333/simplex/solve-integer
```

---

## Exemplo de Requisição

O formato de entrada é idêntico ao endpoint `/simplex/solve`:

```json
{
  "objective": [5, 4],
  "constraints": [
    { "coefficients": [6, 4], "operator": "<=", "rhs": 24 },
    { "coefficients": [1, 2], "operator": "<=", "rhs": 6  }
  ],
  "type": "max"
}
```

---

## Exemplo de Resposta

### Solução ótima inteira encontrada

```json
{
  "message": "Branch and Bound executado com sucesso",
  "data": {
    "objective": [5, 4],
    "constraints": [
      { "coefficients": [6, 4], "operator": "<=", "rhs": 24 },
      { "coefficients": [1, 2], "operator": "<=", "rhs": 6  }
    ],
    "type": "max",
    "status": "optimal",
    "bestSolution": [3, 1],
    "bestObjectiveValue": 19,
    "nodesVisited": 3,
    "nodesPruned": 1,
    "tree": [
      {
        "id": "node_1",
        "level": 0,
        "parentId": null,
        "childrenIds": ["node_2", "node_3"],
        "cuts": [],
        "status": "fractional",
        "solution": [3.0, 1.5],
        "objectiveValue": 21.0
      },
      {
        "id": "node_2",
        "level": 1,
        "parentId": "node_1",
        "childrenIds": [],
        "cuts": [{ "variableIndex": 1, "bound": 1, "type": "leq" }],
        "status": "integer",
        "solution": [3.0, 1.0],
        "objectiveValue": 19.0
      },
      {
        "id": "node_3",
        "level": 1,
        "parentId": "node_1",
        "childrenIds": [],
        "cuts": [{ "variableIndex": 1, "bound": 2, "type": "geq" }],
        "status": "pruned",
        "solution": [2.0, 2.0],
        "objectiveValue": 18.0
      }
    ]
  }
}
```

### Campos retornados

| Campo | Descrição |
| ----- | --------- |
| `status` | Situação da resolução (`optimal` ou `infeasible`) |
| `bestSolution` | Valores inteiros encontrados para as variáveis de decisão |
| `bestObjectiveValue` | Valor ótimo inteiro da função objetivo |
| `nodesVisited` | Total de nós processados na árvore de busca |
| `nodesPruned` | Total de nós podados |
| `tree` | Árvore de busca completa com todos os nós e seus estados |

### Campos de cada nó em `tree`

| Campo | Descrição |
| ----- | --------- |
| `id` | Identificador único do nó |
| `level` | Profundidade na árvore de busca |
| `parentId` | Identificador do nó pai (`null` para a raiz) |
| `childrenIds` | Identificadores dos nós filhos |
| `cuts` | Cortes de branching acumulados desde a raiz |
| `status` | Estado do nó (`fractional`, `integer`, `infeasible`, `pruned`, `unbounded`) |
| `solution` | Solução da relaxação linear neste nó |
| `objectiveValue` | Valor objetivo da relaxação linear neste nó |

---

## Possíveis Respostas de Erro

### Problema sem solução inteira viável

```json
{
  "message": "Não foi possível resolver o problema",
  "status": "infeasible",
  "error": "O problema não possui solução inteira viável.",
  "data": {
    "nodesVisited": 4,
    "nodesPruned": 4,
    "tree": [...]
  }
}
```

### Operador inválido

```json
{
  "error": "O campo \"operator\" de cada restrição deve ser \"<=\", \">=\" ou \"=\""
}
```

---

## Diferença entre os endpoints

| | `/simplex/solve` | `/simplex/solve-integer` |
| --- | --- | --- |
| Método de resolução | Simplex tabular | Branch and Bound |
| Tipo de solução | Contínua | Inteira |
| Campo de solução | `solution` | `bestSolution` |
| Campo de valor ótimo | `optimalValue` | `bestObjectiveValue` |
| Retorna tableau | Sim | Não |
| Retorna árvore de busca | Não | Sim |
| Retorna dados gráficos | Sim (2 variáveis) | Não |

---

## Estado Atual do Desenvolvimento

### Implementado

* Endpoint `POST /simplex/solve-integer`;
* Controller com validações completas;
* Integração com o `BranchAndBoundSolver` existente;
* Retorno da árvore de busca completa;
* Tratamento de resposta para problema inviável.

### Em Desenvolvimento

* Dados gráficos para a solução inteira;
* Suporte a MILP (variáveis mistas inteiras e contínuas).

---

## Branches do Projeto

### main

Versão base do backend com o Método Simplex Tabular.

### simplex-loop

Branch funcional contendo a implementação do Método Simplex utilizada para testes e integração com o frontend.

### integrate-colleague-simplex

Branch experimental destinada à integração de arquitetura mais avançada.

### branch-and-bound

Branch contendo a implementação do método Branch and Bound para Programação Linear Inteira.

### graph-data

Branch contendo a extensão de dados gráficos para visualização da região viável, função objetivo e ponto ótimo.

### big-m

Branch contendo a extensão do Método Simplex com suporte a restrições `>=` e `=` via Método Big M.

### integer-endpoint *(novo)*

Branch contendo a exposição do Branch and Bound via endpoint REST e o alias de importação do módulo.

---

## Repositório

https://github.com/SamuelNascimentoFocas/simplex-system-backend

---

## Autores

Projeto desenvolvido para a disciplina de Pesquisa Operacional.

Equipe responsável pelo desenvolvimento do sistema Simplex, da extensão Branch and Bound, da extensão de dados gráficos, da extensão Big M e do endpoint de resolução inteira.