# Suporte a Restrições `>=` e `=` via Método Big M

Extensão desenvolvida em TypeScript para o projeto da disciplina de Pesquisa Operacional.

O objetivo desta extensão é evoluir o núcleo matemático da aplicação para suportar restrições do tipo `>=` e `=` além das restrições `<=` já suportadas, utilizando o **Método Big M** para introdução de variáveis artificiais.

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

As seguintes mudanças foram realizadas:

**Novos tipos exportados**

```typescript
export type ConstraintOperator = '<=' | '>=' | '='

export type ConstraintInput = {
  coefficients: number[]
  operator: ConstraintOperator
  rhs: number
}

export type SimplexInput = {
  objective: number[]
  constraints: ConstraintInput[]
  type: 'max' | 'min'
}
```

O tipo `ConstraintInput` substitui o uso de `number[][]` para restrições, incorporando o operador e o RHS em cada restrição individualmente. O tipo `SimplexInput` foi atualizado para refletir essa mudança.

**Novo método público: `createInitialTableauWithMeta`**

```typescript
createInitialTableauWithMeta(input: SimplexInput): StandardForm
```

Retorna o tableau inicial junto com os metadados da forma padrão, incluindo `artificialVarIndices` e `hasArtificialVars`. O controller utiliza esses dados para verificar inviabilidade após a resolução.

O método `createInitialTableau` foi preservado como fachada pública para compatibilidade com outros consumidores existentes.

**Novo método público: `isInfeasible`**

```typescript
isInfeasible(finalTableau: number[][], artificialVarIndices: number[]): boolean
```

Verifica se alguma variável artificial permaneceu na base com valor positivo ao final do Simplex, o que indica que o problema não possui solução viável. Essa verificação é obrigatória com Big M, pois o algoritmo converge mesmo em problemas inviáveis — a penalização apenas encarece, mas não impede a permanência de artificiais na base.

**Novo método privado: `convertToStandardForm`**

Responsável por converter o problema para a forma padrão expandida e montar o tableau inicial com penalização Big M. Implementa as seguintes regras por operador:

| Operador | Variáveis adicionadas |
| -------- | --------------------- |
| `<=` | Variável de folga (`+1`) |
| `>=` | Variável de excesso (`-1`) + variável artificial (`+1`) |
| `=` | Variável artificial (`+1`) |

Restrições com `rhs < 0` são normalizadas automaticamente: a restrição é multiplicada por `-1` e o operador é invertido antes da alocação das variáveis extras.

**Novo método privado: `adjustObjectiveForArtificials`**

Realiza o ajuste canônico obrigatório após a inserção das penalidades Big M na linha objetivo. Para cada variável artificial na base inicial, subtrai `M` vezes a linha de restrição correspondente da linha objetivo, zerando os coeficientes das artificiais na linha Z e estabelecendo a forma canônica necessária para o critério de parada do Simplex.

**Métodos não alterados**

Os seguintes métodos permaneceram sem nenhuma modificação:

* `findPivotColumn`
* `findPivotRow`
* `pivot`
* `solve`
* `extractSolution`
* `hasMultipleOptimalSolutions`

---

#### `app/controllers/simplex_controller.ts`

**Novo contrato da API**

O campo `rhs` separado foi removido. O campo `constraints` deixou de ser `number[][]` e passou a ser um array de objetos:

```json
{
  "coefficients": [1, 2],
  "operator": "<=",
  "rhs": 4
}
```

**Validações adaptadas**

* Removida a validação que rejeitava `rhs < 0` — o conversor trata isso internamente;
* Adicionada validação do campo `operator` contra os valores `"<="`, `">="` e `"="`;
* Adicionada validação de que `rhs` é um número finito, sem restrição de sinal;
* As validações de `coefficients` foram adaptadas para a nova estrutura de objeto.

**Detecção de inviabilidade**

Após a resolução, o controller verifica inviabilidade chamando `isInfeasible` com os `artificialVarIndices` retornados por `createInitialTableauWithMeta`. Quando inviável, retorna:

```json
{
  "message": "Não foi possível resolver o problema",
  "status": "infeasible",
  "error": "O problema não possui solução viável. As restrições são incompatíveis entre si."
}
```

**Compatibilidade com `GraphService`**

O `GraphService` foi projetado para receber `coefficients` e `rhs` separados. O controller extrai esses campos das restrições no novo formato antes de chamar o serviço, sem modificar o `GraphService`.

---

## Novo Contrato da API

### Endpoint

```http
POST /simplex/solve
```

### Body (JSON)

```json
{
  "objective": [5, 4, 3],
  "constraints": [
    { "coefficients": [6, 4, 2], "operator": "<=", "rhs": 240 },
    { "coefficients": [3, 2, 5], "operator": "<=", "rhs": 270 },
    { "coefficients": [5, 6, 5], "operator": "<=", "rhs": 420 },
    { "coefficients": [1, 0, 0], "operator": ">=", "rhs": 10  },
    { "coefficients": [0, 1, 0], "operator": "=",  "rhs": 15  }
  ],
  "type": "max"
}
```

### Campos

| Campo | Tipo | Descrição |
| ----- | ---- | --------- |
| `objective` | `number[]` | Coeficientes da função objetivo |
| `constraints` | `ConstraintInput[]` | Array de restrições |
| `constraints[i].coefficients` | `number[]` | Coeficientes da restrição |
| `constraints[i].operator` | `"<="` \| `">="` \| `"="` | Operador da restrição |
| `constraints[i].rhs` | `number` | Lado direito da restrição (pode ser negativo) |
| `type` | `"max"` \| `"min"` | Tipo do problema |

---

## Funcionamento do Método Big M

O Método Big M é uma estratégia para lidar com restrições `>=` e `=`, que não possuem variável de folga para servir como base inicial viável.

### Variáveis artificiais

Para cada restrição `>=` ou `=`, uma variável artificial é introduzida para fornecer uma base inicial viável. Essas variáveis não têm significado econômico e devem sair da base antes da solução ótima.

### Penalização

Cada variável artificial recebe um coeficiente `+M` na função objetivo (onde `M = 10.000.000`), tornando economicamente proibitório que permaneçam na solução ótima:

* Em **maximização**: manter uma artificial reduz Z em M, forçando o Simplex a retirá-la da base;
* Em **minimização**: manter uma artificial aumenta Z em M, com o mesmo efeito.

### Ajuste canônico

Antes de iniciar o loop de pivotamento, a linha objetivo é ajustada para a forma canônica. Para cada artificial na base inicial, subtrai-se `M` vezes a linha de restrição correspondente da linha objetivo. Sem esse ajuste, o critério de parada do Simplex falharia.

### Detecção de inviabilidade

Após a convergência do Simplex, verifica-se se alguma variável artificial permaneceu na base com valor positivo. Se sim, o problema não possui solução viável e a API retorna `status: "infeasible"`.

---

## Exemplos de Requisição

### Apenas `<=` (comportamento original preservado)

```json
{
  "objective": [3, 5],
  "constraints": [
    { "coefficients": [1, 0], "operator": "<=", "rhs": 4  },
    { "coefficients": [0, 2], "operator": "<=", "rhs": 12 },
    { "coefficients": [3, 2], "operator": "<=", "rhs": 18 }
  ],
  "type": "max"
}
```

### Com `>=`

```json
{
  "objective": [2, 3],
  "constraints": [
    { "coefficients": [1, 1], "operator": "<=", "rhs": 4 },
    { "coefficients": [1, 0], "operator": ">=", "rhs": 1 },
    { "coefficients": [0, 1], "operator": ">=", "rhs": 1 }
  ],
  "type": "max"
}
```

### Com `=`

```json
{
  "objective": [3, 5],
  "constraints": [
    { "coefficients": [1, 1], "operator": "<=", "rhs": 10 },
    { "coefficients": [1, 0], "operator": "=",  "rhs": 4  }
  ],
  "type": "max"
}
```

### Problema inviável

```json
{
  "objective": [1, 1],
  "constraints": [
    { "coefficients": [1, 1], "operator": "<=", "rhs": 5 },
    { "coefficients": [1, 1], "operator": ">=", "rhs": 8 }
  ],
  "type": "max"
}
```

---

## Possíveis Respostas de Erro

### Problema inviável

```json
{
  "message": "Não foi possível resolver o problema",
  "status": "infeasible",
  "error": "O problema não possui solução viável. As restrições são incompatíveis entre si."
}
```

### Problema ilimitado

```json
{
  "message": "Não foi possível resolver o problema",
  "status": "unbounded",
  "error": "Problema ilimitado: não foi possível encontrar linha pivô"
}
```

### Operador inválido

```json
{
  "error": "O campo \"operator\" de cada restrição deve ser \"<=\", \">=\" ou \"=\""
}
```

---

## Estado Atual do Desenvolvimento

### Implementado

* Suporte a restrições `<=`, `>=` e `=`;
* Introdução de variáveis de folga, excesso e artificiais;
* Método Big M para penalização de variáveis artificiais;
* Ajuste canônico da linha objetivo;
* Normalização automática de restrições com `rhs < 0`;
* Detecção de inviabilidade pós-resolução;
* Novo contrato da API com operador por restrição.

### Em Desenvolvimento

* Método das Duas Fases como alternativa ao Big M;
* Casos avançados de degeneração;
* Integração dos novos tipos de restrição com o Branch and Bound.

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

### big-m *(novo)*

Branch contendo a extensão do Método Simplex com suporte a restrições `>=` e `=` via Método Big M.

---

## Repositório

https://github.com/SamuelNascimentoFocas/simplex-system-backend

---

## Autores

Projeto desenvolvido para a disciplina de Pesquisa Operacional.

Equipe responsável pelo desenvolvimento do sistema Simplex, da extensão Branch and Bound, da extensão de dados gráficos e da extensão Big M.