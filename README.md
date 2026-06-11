# Branch and Bound — Extensão do Simplex System Backend

Extensão desenvolvida em TypeScript para o projeto da disciplina de Pesquisa Operacional.

O objetivo desta extensão é evoluir o núcleo matemático da aplicação para suportar **Programação Linear Inteira (PLI)** por meio do método **Branch and Bound**, reutilizando integralmente o solver Simplex já existente.

---

## Tecnologias Utilizadas

* Node.js
* TypeScript
* AdonisJS 6
* Git
* GitHub

---

## O que foi alterado

### Arquivos adicionados

```txt
app/branch_and_bound/
├── types.ts
├── BranchNode.ts
├── BranchAndBoundSolver.ts
└── index.ts
```

---

## Estrutura do Projeto Atualizada

```txt
start/routes.ts
        ↓
app/controllers/simplex_controller.ts
        ↓
app/services/simplex_service.ts
        ↑
app/branch_and_bound/BranchAndBoundSolver.ts
```

O `BranchAndBoundSolver` atua como uma camada superior ao `SimplexService`, sem modificar nem duplicar nenhuma de suas responsabilidades.

---

## Responsabilidades dos Novos Arquivos

#### `types.ts`

Define todas as interfaces e tipos utilizados pelo Branch and Bound:

* `BranchAndBoundInput` — entrada do problema (idêntica ao `SimplexInput` original);
* `BranchCut` — representa um corte de ramificação (`x_j ≤ b` ou `x_j ≥ b`);
* `NodeStatus` — estado possível de um nó da árvore;
* `BranchNode` — estrutura completa de um nó;
* `BranchAndBoundResult` — resultado retornado pelo solver.

#### `BranchNode.ts`

Responsável por:

* Criar nós da árvore com identificadores únicos;
* Resetar o contador de nós a cada nova execução.

#### `BranchAndBoundSolver.ts`

Responsável por:

* Receber o problema de PLI;
* Gerenciar a fila de nós (BFS);
* Montar as restrições de cada nó (originais + cortes herdados);
* Chamar o `SimplexService` para resolver cada relaxação linear;
* Aplicar as estratégias de poda;
* Decidir a ramificação quando a solução for fracionária;
* Retornar o resultado final com a árvore de busca completa.

#### `index.ts`

Barrel export para facilitar a importação dos módulos do Branch and Bound.

---

## Fluxo Completo de Execução

```txt
BranchAndBoundSolver.solve(input)
        ↓
Cria nó raiz (sem cortes adicionais)
        ↓
Fila BFS de nós pendentes
        ↓
Para cada nó:
        ↓
Monta restrições (originais + cortes herdados)
        ↓
SimplexService.createInitialTableau(...)
        ↓
SimplexService.solve(tableau)
        ↓
Obtém solução da relaxação linear
        ↓
Verifica condições de poda:
  ├── Inviabilidade   → poda
  ├── Problema ilimitado → poda
  ├── Bound inferior ao melhor conhecido → poda
  └── Solução inteira → atualiza melhor solução
        ↓
Solução fracionária:
  ├── Filho esquerdo: x_j ≤ floor(valor)
  └── Filho direito:  x_j ≥ ceil(valor)
```

---

## Estratégia de Branching

A variável escolhida para ramificação é a **primeira variável de decisão com valor fracionário** encontrada na solução da relaxação linear.

Dado um valor fracionário `v` na variável `x_j`, são criados dois nós filhos:

| Nó filho | Corte adicionado |
| -------- | ---------------- |
| Esquerdo | `x_j ≤ floor(v)` |
| Direito  | `x_j ≥ ceil(v)`  |

---

## Estratégias de Poda

### Poda por inviabilidade

Quando o tableau final contém algum valor de RHS negativo em uma linha de restrição, o nó é considerado inviável e descartado.

### Poda por ilimitado

Quando o `SimplexService` lança exceção de problema ilimitado, o nó é podado com status `unbounded`.

### Poda por integralidade

Quando todas as variáveis de decisão possuem valores inteiros, o nó é marcado como `integer` e sua solução é candidata à solução ótima.

### Poda por bound

| Tipo do problema | Condição de poda |
| ---------------- | ---------------- |
| Maximização | `objetivo ≤ melhor solução conhecida` |
| Minimização | `objetivo ≥ melhor solução conhecida` |

---

## Estrutura do Nó

```typescript
{
  id: string                // identificador único (ex: "node_1")
  level: number             // profundidade na árvore
  parentId: string | null   // identificador do nó pai
  childrenIds: string[]     // identificadores dos nós filhos
  cuts: BranchCut[]         // cortes acumulados desde a raiz
  status: NodeStatus        // estado do nó
  solution: number[] | null
  objectiveValue: number | null
}
```

#### Valores possíveis de `NodeStatus`

| Status | Significado |
| ------ | ----------- |
| `pending` | Nó ainda não processado |
| `fractional` | Solução fracionária — nó ramificado |
| `integer` | Solução inteira — candidata ao ótimo |
| `infeasible` | Relaxação linear inviável |
| `unbounded` | Problema ilimitado |
| `pruned` | Podado por bound |

---

## Resultado Retornado

```typescript
{
  status: 'optimal' | 'infeasible' | 'unbounded'
  bestSolution: number[] | null
  bestObjectiveValue: number | null
  nodesVisited: number
  nodesPruned: number
  tree: BranchNode[]
}
```

---

## Como Integrar ao Controller

O `SimplexController` existente **não foi modificado**. Para expor o Branch and Bound via API, basta criar um novo endpoint e instanciar o solver:

```typescript
import { BranchAndBoundSolver } from '#branch_and_bound/index'

// dentro de um novo método no controller:
const solver = new BranchAndBoundSolver()
const result = solver.solve({ objective, constraints, rhs, type })

return response.ok({
  message: 'Branch and Bound executado com sucesso',
  data: result,
})
```

A entrada segue o mesmo formato JSON já utilizado no endpoint `/simplex/solve`.

---

## Exemplo de Requisição

```json
{
  "objective": [5, 4],
  "constraints": [
    [6, 4],
    [1, 2]
  ],
  "rhs": [24, 6],
  "type": "max"
}
```

---

## Exemplo de Resposta

```json
{
  "message": "Branch and Bound executado com sucesso",
  "data": {
    "status": "optimal",
    "bestSolution": [3, 1],
    "bestObjectiveValue": 19,
    "nodesVisited": 5,
    "nodesPruned": 2,
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
      }
    ]
  }
}
```

---

## Casos Suportados

* Maximização
* Minimização
* Solução inteira ótima
* Problema inviável
* Problema ilimitado
* Poda por bound
* Poda por integralidade

---

## Limitações Conhecidas

### Detecção de inviabilidade

O `SimplexService` atual não lança exceção para problemas inviáveis — apenas para ilimitados. A detecção de inviabilidade no Branch and Bound utiliza uma heurística (RHS negativo no tableau final), que cobre a maioria dos casos mas não é garantida em todos os cenários. A solução definitiva exige a implementação do Simplex de Fase I ou método Big M no `SimplexService`, já listado como trabalho futuro no README original.

### Cortes de `x_j ≥ b` com `b > 0`

Cortes do tipo `≥` são convertidos internamente para `≤` por multiplicação por `-1`, resultando em RHS negativo. Isso contorna a restrição do controller (que bloqueia RHS negativo nas requisições externas) sem violar a corretude matemática, pois a operação ocorre apenas internamente ao solver. Deve ser revisado caso o `SimplexService` seja estendido para suportar Fase I.

### Sem limite de nós

Não há controle de `maxNodes`. Para problemas com muitas variáveis inteiras, a árvore pode crescer de forma exponencial. Recomenda-se adicionar um limite configurável antes de utilizar em produção.

### Programação Inteira Mista (MILP)

A implementação atual trata todas as variáveis de decisão como inteiras. A arquitetura foi projetada para suportar MILP futuramente (basta indicar quais variáveis são inteiras em `BranchAndBoundInput`), mas essa funcionalidade ainda não está implementada.

---

## Estado Atual do Desenvolvimento

### Implementado

* Estrutura completa do Branch and Bound;
* Reutilização integral do `SimplexService` existente;
* Estratégia de branching pela primeira variável fracionária;
* Poda por inviabilidade;
* Poda por problema ilimitado;
* Poda por bound (maximização e minimização);
* Poda por integralidade;
* Preservação da árvore de busca completa em memória;

### Em Desenvolvimento

* Suporte a MILP (variáveis mistas inteiras e contínuas);
* Limite configurável de nós visitados;
* Detecção robusta de inviabilidade via Fase I ou Big M;
* Estratégias alternativas de branching (most fractional, pseudo-cost).

---

## Branches do Projeto

### main

Versão base do backend com o Método Simplex Tabular.

### simplex-loop

Branch funcional contendo a implementação do Método Simplex utilizada para testes e integração com o frontend.

### integrate-colleague-simplex

Branch experimental destinada à integração de arquitetura mais avançada com suporte futuro a Forma Padrão, Método Big M e restrições `>=` e `=`.

### branch-and-bound *(novo)*

Branch contendo a implementação do método Branch and Bound para resolução de problemas de Programação Linear Inteira.

---

## Repositório

https://github.com/SamuelNascimentoFocas/simplex-system-backend

---

## Autores

Projeto desenvolvido para a disciplina de Pesquisa Operacional.

Equipe responsável pelo desenvolvimento do sistema Simplex e da extensão Branch and Bound.