# Simplex System Backend

Backend desenvolvido em AdonisJS 6 para o projeto da disciplina de Pesquisa Operacional.

O objetivo deste sistema é implementar o Método Simplex Tabular para resolução de problemas de Programação Linear por meio de uma API REST que poderá ser integrada a um frontend desenvolvido em React.

---

## Tecnologias Utilizadas

* Node.js
* TypeScript
* AdonisJS 6
* Git
* GitHub

---

## Funcionalidades Implementadas

Atualmente o sistema possui as seguintes funcionalidades:

* Validação completa da entrada recebida pela API;
* Construção automática do tableau inicial;
* Identificação da coluna pivô;
* Identificação da linha pivô;
* Execução automática do Método Simplex até atingir a solução ótima;
* Extração da solução ótima das variáveis de decisão;
* Cálculo do valor ótimo da função objetivo;
* Registro do histórico completo das iterações;
* Contagem do número de iterações realizadas;
* Detecção de múltiplas soluções ótimas;
* Detecção de problemas ilimitados (unbounded);
* Tratamento de casos com RHS negativo como funcionalidade ainda não suportada.

---

## Estrutura do Projeto

```txt
start/routes.ts
        ↓
app/controllers/simplex_controller.ts
        ↓
app/services/simplex_service.ts
```

### Responsabilidades

#### routes.ts

Responsável por definir os endpoints da API.

#### simplex_controller.ts

Responsável por:

* Receber requisições;
* Validar dados;
* Chamar os serviços responsáveis pela lógica do Simplex;
* Retornar respostas para o cliente.

#### simplex_service.ts

Responsável por:

* Construção do tableau inicial;
* Identificação da coluna pivô;
* Identificação da linha pivô;
* Execução das iterações do Método Simplex;
* Extração da solução ótima;
* Cálculo do valor ótimo;
* Detecção de múltiplas soluções;
* Tratamento de problemas ilimitados.

---

## Endpoint Disponível

### Resolver Problema Simplex

```http
POST /simplex/solve
```

### URL Local

```txt
http://localhost:3333/simplex/solve
```

---

## Exemplo de Requisição

### Body (JSON)

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

### Significado dos Campos

| Campo       | Descrição                            |
| ----------- | ------------------------------------ |
| objective   | Coeficientes da função objetivo      |
| constraints | Matriz das restrições                |
| rhs         | Vetor do lado direito das restrições |
| type        | Tipo do problema ("max" ou "min")    |

---

## Exemplo de Resposta

### Resposta Resumida

```json
{
  "message": "Simplex executado com sucesso",
  "data": {
    "status": "optimal",
    "solution": [2, 6],
    "optimalValue": 36,
    "hasMultipleSolutions": false,
    "iterationsCount": 2
  }
}
```

### Campos Retornados

| Campo                | Descrição                                        |
| -------------------- | ------------------------------------------------ |
| status               | Situação da resolução do problema                |
| solution             | Valores encontrados para as variáveis de decisão |
| optimalValue         | Valor ótimo da função objetivo                   |
| hasMultipleSolutions | Indica se existem múltiplas soluções ótimas      |
| iterationsCount      | Quantidade de iterações realizadas               |
| initialTableau       | Tableau inicial                                  |
| finalTableau         | Tableau final                                    |
| iterations           | Histórico completo das iterações                 |

---

## Possíveis Respostas de Erro

### Problema Ilimitado

```json
{
  "message": "Não foi possível resolver o problema",
  "status": "unbounded",
  "error": "Problema ilimitado: não foi possível encontrar linha pivô"
}
```

### RHS Negativo (Não Suportado Atualmente)

```json
{
  "message": "Não foi possível resolver o problema",
  "status": "unsupported",
  "error": "O método Simplex padrão implementado atualmente exige que todos os valores de rhs sejam maiores ou iguais a zero. Casos com rhs negativo exigem tratamento adicional, como Big M ou método das Duas Fases."
}
```

---

## Estado Atual do Desenvolvimento

### Implementado

* Estrutura completa da API;
* Validação dos dados;
* Construção do tableau inicial;
* Método Simplex tabular para maximização;
* Critério de parada;
* Histórico completo das iterações;
* Extração da solução ótima;
* Cálculo do valor ótimo de Z;
* Detecção de múltiplas soluções ótimas;
* Tratamento de problemas ilimitados;
* Tratamento de casos com RHS negativo.

### Em Desenvolvimento

* Integração com Forma Padrão;
* Suporte a restrições do tipo `>=` e `=`;
* Método Big M;
* Revisão completa da minimização;
* Casos avançados de inviabilidade.

---

## Branches do Projeto

### main

Versão base do backend.

### simplex-loop

Branch funcional contendo a implementação atual do Método Simplex utilizada para testes e integração com o frontend.

### integrate-colleague-simplex

Branch experimental destinada à integração de uma arquitetura mais avançada contendo suporte futuro para Forma Padrão, Método Big M e restrições do tipo `>=` e `=`.

---

## Como Executar o Projeto

### Clonar o Repositório

```bash
git clone https://github.com/SamuelNascimentoFocas/simplex-system-backend.git
```

### Acessar a Pasta

```bash
cd simplex-system-backend
```

### Instalar Dependências

```bash
npm install
```

### Executar em Desenvolvimento

```bash
npm run dev
```

O servidor será iniciado em:

```txt
http://localhost:3333
```

---

## Integração com Frontend

O frontend pode consumir o endpoint:

```http
POST /simplex/solve
```

enviando um JSON contendo:

* função objetivo;
* restrições;
* vetor RHS;
* tipo do problema.

A resposta retorna:

* solução ótima;
* valor ótimo;
* quantidade de iterações;
* histórico completo das iterações;
* tableau inicial;
* tableau final.

---

## Repositório

https://github.com/SamuelNascimentoFocas/simplex-system-backend

---

## Autores

Projeto desenvolvido para a disciplina de Pesquisa Operacional.

Equipe responsável pelo desenvolvimento do sistema Simplex.
