# Simplex System Backend

Backend desenvolvido em AdonisJS 6 para o projeto da disciplina de Pesquisa Operacional.

O objetivo deste sistema é implementar o método Simplex Tabular, permitindo a resolução de problemas de Programação Linear por meio de uma API REST que poderá ser integrada a um frontend desenvolvido em React.

## Tecnologias Utilizadas

* Node.js
* TypeScript
* AdonisJS 6
* Git
* GitHub

---

## Funcionalidades Implementadas

Atualmente o sistema possui as seguintes funcionalidades:

* Validação da entrada recebida pela API;
* Construção automática do tableau inicial;
* Identificação da coluna pivô;
* Identificação da linha pivô;
* Execução da primeira operação de pivoteamento;
* Retorno estruturado em formato JSON.

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

* receber requisições;
* validar dados;
* chamar os serviços responsáveis pela lógica do Simplex;
* retornar respostas para o cliente.

#### simplex_service.ts

Responsável por:

* criar o tableau inicial;
* encontrar a coluna pivô;
* encontrar a linha pivô;
* executar o pivoteamento.

---

## Endpoint Disponível

### Resolver Problema Simplex

```http
POST /simplex/solve
```

### Exemplo de Entrada

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

### Exemplo de Saída

```json
{
  "message": "Tableau inicial criado com sucesso",
  "data": {
    "tableau": [],
    "pivotColumn": 1,
    "pivotRow": 1,
    "nextTableau": []
  }
}
```

---

## Estado Atual do Desenvolvimento

Implementado:

* Estrutura base da API;
* Validação dos dados;
* Tableau inicial;
* Coluna pivô;
* Linha pivô;
* Primeira iteração do método Simplex.

Ainda pendente:

* Loop completo do método Simplex;
* Critério de parada;
* Histórico das iterações;
* Extração da solução ótima;
* Cálculo do valor ótimo de Z;
* Tratamento de casos especiais;
* Revisão completa do suporte à minimização.

---

## Como Executar o Projeto

### Instalar dependências

```bash
npm install
```

### Executar em desenvolvimento

```bash
npm run dev
```

O servidor será iniciado em:

```txt
http://localhost:3333
```

---

## Repositório

https://github.com/SamuelNascimentoFocas/simplex-system-backend

---

## Autores

Projeto desenvolvido para a disciplina de Pesquisa Operacional.

Equipe responsável pelo desenvolvimento do sistema Simplex.
