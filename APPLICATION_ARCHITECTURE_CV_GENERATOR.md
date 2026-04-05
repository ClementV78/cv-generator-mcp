# Architecture Applicative - CV Generator

## Objet

Ce document decrit l'architecture applicative du projet `CV_Generator` :

- ses composants
- leurs responsabilites
- les flux entre eux
- les frontieres techniques
- les points d'entree

Ce document est volontairement descriptif.

Il ne sert pas a argumenter un choix ; il sert a expliquer **comment l'application est construite et comment elle fonctionne**.

---

## Vue D'Ensemble

L'application est composee de 3 sous-systemes principaux :

1. **UI Web**
2. **CV Engine**
3. **Serveur MCP local**

Positionnement :

- l'UI web est l'interface d'edition humaine
- le moteur Node est la source de verite
- le serveur MCP est la couche d'exposition principale pour les agents

```mermaid
flowchart LR
    UI[UI Web / Editeur]
    ENGINE[CV Engine]
    MCP[MCP Server local]
    PDF[PDF Headless]
    HTML[HTML Export]
    JSON[JSON Export]

    UI --> ENGINE
    MCP --> ENGINE
    ENGINE --> HTML
    ENGINE --> JSON
    ENGINE --> PDF

    classDef ui fill:#EAF2FF,stroke:#5B8DEF,color:#1A2D4A,stroke-width:2px;
    classDef engine fill:#EBF8EF,stroke:#3DA35D,color:#183D22,stroke-width:2px;
    classDef infra fill:#FFF3E6,stroke:#E67E22,color:#5A3600,stroke-width:2px;

    class UI ui;
    class ENGINE,HTML,JSON,PDF engine;
    class MCP infra;
```

---

## Structure Des Dossiers

```text
CV_Generator/
  src/
    app.ts
    main.ts
    model.ts
    types.ts
    validation.ts
    styles.css
    data/
      presets.ts
      sampleCv.ts
    engine/
      index.ts
      output.ts
      qr.ts
      renderHtml.ts
      renderHtmlNode.ts
      renderPdf.ts
      schema.ts
      service.ts
      validateNode.ts
      validationBrowser.ts
    mcp/
      server.ts
  scripts/
    smoke-pdf.ts
  tests/
    fixtures/
    engine-service.test.ts
    mcp-server.test.ts
    render-pdf.test.ts
```

---

## Sous-Systeme 1 - UI Web

## Role

La UI web sert a l'edition humaine du CV.

Elle permet :

- la modification inline du contenu
- le choix du theme
- le choix de la position de la sidebar
- l'import/export JSON et HTML
- la previsualisation

## Fichiers Principaux

- [main.ts](./src/main.ts)
- [app.ts](./src/app.ts)
- [styles.css](./src/styles.css)
- [store.ts](./src/store.ts)

## Fonctionnement

```mermaid
flowchart TD
    A[Utilisateur] --> B[main.ts]
    B --> C[CvStore]
    C --> D[renderApp]
    D --> E[DOM]
    E --> F[Interactions utilisateur]
    F --> B

    classDef ui fill:#EAF2FF,stroke:#5B8DEF,color:#1A2D4A,stroke-width:2px;
    class A,B,C,D,E,F ui;
```

### `main.ts`

Responsabilites :

- chargement de l'etat initial
- ecoute des evenements DOM
- orchestration des actions utilisateur
- rerender de l'application
- import/export cote navigateur

### `app.ts`

Responsabilites :

- composition du markup HTML
- rendu du CV
- rendu des controles d'edition

### `store.ts`

Responsabilites :

- stockage de l'etat courant
- diffusion des mises a jour

### `styles.css`

Responsabilites :

- structure visuelle du template
- themes
- presentation print
- presentation edition / preview

---

## Sous-Systeme 2 - Modele Metier

## Role

Le modele metier decrit la structure d'un CV.

## Fichiers Principaux

- [types.ts](./src/types.ts)
- [model.ts](./src/model.ts)
- [constants.ts](./src/constants.ts)

## `types.ts`

Contient :

- `CvData`
- `HeaderData`
- `SkillGroup`
- `Experience`
- `SidebarCard`
- `RenderSettings`
- types utilitaires de validation

## `model.ts`

Contient :

- normalisation de `CvData`
- valeurs par defaut
- creation d'elements
- manipulation par chemin (`setValueAtPath`, `moveItemAtPath`, etc.)
- migration douce de certaines valeurs

## Schema Logique Du Modele

```mermaid
classDiagram
    class CvData {
      +HeaderData header
      +string profileLabel
      +string profile
      +SkillGroup[] skillGroups
      +TextItem[] highlights
      +SidebarCard[] certifications
      +SidebarCard[] formations
      +LanguageCard[] languages
      +Experience[] experiences
      +MainEducationBlock mainEducation
      +RenderSettings render
    }

    class RenderSettings {
      +EditorMode mode
      +1|2|3|null maxPages
      +CvTheme theme
      +SidebarPosition sidebarPosition
    }

    class Experience {
      +string company
      +string role
      +string period
      +string subtitle
      +TextItem[] bullets
      +string techEnvironmentLabel
      +string techEnvironment
      +ExperienceProject[] projects
    }

    class ExperienceProject {
      +string title
      +string period
      +TextItem[] bullets
      +string techEnvironmentLabel
      +string techEnvironment
    }

    CvData --> RenderSettings
    CvData --> Experience
    Experience --> ExperienceProject
```

---

## Sous-Systeme 3 - Validation

## Role

Le projet contient 2 types de validation :

1. validation navigateur
2. validation Node/headless

## Validation Navigateur

Fichiers :

- [validation.ts](./src/validation.ts)
- [validationBrowser.ts](./src/engine/validationBrowser.ts)

Usage :

- feedback visuel dans l'editeur
- surlignage des depassements
- estimation de pagination a l'ecran

## Validation Node

Fichier :

- [validateNode.ts](./src/engine/validateNode.ts)

Usage :

- validation utilisable hors UI
- mesure headless via Playwright
- production de `pageCount`, `issues`, `structureMessages`

## Flux De Validation

```mermaid
flowchart LR
    INPUT[CvData] --> NORM[normalizeCvData]
    NORM --> STRUCT[Validation structurelle]
    STRUCT --> RENDER[Validation de rendu]
    RENDER --> RESULT[ValidationResult]

    classDef block fill:#EBF8EF,stroke:#3DA35D,color:#183D22,stroke-width:2px;
    class INPUT,NORM,STRUCT,RENDER,RESULT block;
```

---

## Sous-Systeme 4 - CV Engine

## Role

Le `CV Engine` est la couche reutilisable.

Il encapsule :

- la normalisation
- la validation
- le rendu HTML
- le rendu PDF
- l'acces au schema

## Fichiers Principaux

- [service.ts](./src/engine/service.ts)
- [renderHtml.ts](./src/engine/renderHtml.ts)
- [renderHtmlNode.ts](./src/engine/renderHtmlNode.ts)
- [renderPdf.ts](./src/engine/renderPdf.ts)
- [schema.ts](./src/engine/schema.ts)
- [output.ts](./src/engine/output.ts)
- [qr.ts](./src/engine/qr.ts)

## Organisation Interne

```mermaid
flowchart TD
    A[service.ts] --> B[normalizeCvData]
    A --> C[validateCvInput]
    A --> D[renderCvHtmlDocumentNode]
    A --> E[renderCvPdf]
    A --> F[getCvSchema]

    D --> G[renderHtmlNode.ts]
    E --> H[renderPdf.ts]
    H --> I[Playwright]
    D --> J[qr.ts]

    classDef eng fill:#EBF8EF,stroke:#3DA35D,color:#183D22,stroke-width:2px;
    class A,B,C,D,E,F,G,H,I,J eng;
```

### `service.ts`

Facade principale de l'engine.

Expose :

- `prepareCvData`
- `validateCvInput`
- `generateCvArtifact`
- `getCvSchema`
- `exportCvJson`

### `renderHtml.ts`

Renderer HTML cote navigateur.

Usage :

- export HTML depuis l'UI

### `renderHtmlNode.ts`

Renderer HTML cote Node.

Usage :

- generation headless
- source de verite pour le PDF

### `renderPdf.ts`

Renderer PDF headless via `playwright-core`.

Supporte :

- `mode: "paginated"`
- `mode: "continuous"`

### `schema.ts`

Expose le JSON Schema de `CvData`.

### `output.ts`

Responsable de l'ecriture securisee des artefacts binaires temporaires.

### `qr.ts`

Responsable de la generation du QR code.

## Contrat d'entree et separation des parametres

Le contrat principal du systeme reste `CvData`.

Les parametres se repartissent ainsi :

- parametres metier et rendu dans `cv_data`
- parametres d'execution au niveau du tool MCP

Exemples :

- `cv_data.render.theme`
- `cv_data.render.sidebarPosition`
- `cv_data.render.maxPages`
- `generate_cv_pdf.pdf_mode`
- `generate_cv_* .browser_executable_path`

Important :

- `pageCount` n'est pas un champ metier de `CvData`
- c'est une metrique calculee par le moteur

---

## Modes D'Export

L'engine supporte 3 formats d'artefacts :

- `json`
- `html`
- `pdf`

## Pipeline D'Export

```mermaid
flowchart LR
    A[Input CvData] --> B[prepareCvData]
    B --> C{format}
    C -->|json| D[exportCvJson]
    C -->|html| E[renderCvHtmlDocumentNode]
    C -->|pdf| F[renderCvPdf]
    F --> G[Playwright PDF]

    classDef flow fill:#EBF8EF,stroke:#3DA35D,color:#183D22,stroke-width:2px;
    class A,B,C,D,E,F,G flow;
```

### PDF - Mode `paginated`

Comportement :

- A4
- marges fixes
- fonds imprimes
- pagination classique

### PDF - Mode `continuous`

Comportement :

- une seule grande page PDF
- hauteur calculee selon le contenu
- pas de coupure visuelle entre pages

## Regles de pagination

Quand `render.maxPages` est defini :

- la validation expose `page_limit_exceeded`
- les exports `html` et `pdf` pagine peuvent refuser le rendu final
- le mode PDF `continuous` peut rester autorise comme mode de sortie alternatif

---

## Sous-Systeme 5 - MCP Server

## Role

Le serveur MCP expose le moteur a un agent externe.

## Fichier Principal

- [server.ts](./src/mcp/server.ts)

## Transport

- `stdio`

Le serveur :

- n'est pas un serveur HTTP
- n'est pas la UI
- tourne en process local

## Tools Exposes

- `generate_cv_html`
- `generate_cv_pdf`
- `validate_cv`
- `get_cv_schema`

## Semantique des tools

### `get_cv_schema`

Retourne le schema JSON du contrat `CvData`.

### `validate_cv`

Normalise et valide un `CvData`, puis retourne :

- diagnostics structurels
- diagnostics de rendu
- `page_count`
- `page_limit_exceeded`

### `generate_cv_html`

Genere le rendu HTML final a partir d'un `CvData` valide.

### `generate_cv_pdf`

Genere le rendu PDF final a partir d'un `CvData` valide.

Le tool supporte 2 modes :

- `paginated`
- `continuous`

## Flux MCP

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as MCP Server
    participant Engine as CV Engine

    Client->>Server: callTool(generate_cv_pdf, payload)
    Server->>Engine: validateCvInput(payload.cv_data)
    Server->>Engine: generateCvArtifact(format=pdf)
    Engine-->>Server: PDF + metadata
    Server-->>Client: structured response
```

## Comportement du serveur

Pour chaque tool :

1. reception de l'entree
2. validation du payload
3. appel a la facade `engine/service.ts`
4. construction d'une reponse MCP structuree

En cas d'erreur :

- retour `isError: true`
- `structuredContent` stable

---

## Sous-Systeme 6 - Tests

## Role

Verifier :

- le schema
- le moteur
- le PDF
- le serveur MCP

## Fichiers Principaux

- [engine-service.test.ts](./tests/engine-service.test.ts)
- [render-pdf.test.ts](./tests/render-pdf.test.ts)
- [mcp-server.test.ts](./tests/mcp-server.test.ts)

## Couverture Actuelle

### Engine

- schema accessible
- normalisation
- generation HTML

### PDF

- generation PDF valide
- mode pagine
- mode continu
- erreur structurée si navigateur absent

### MCP

- listing des tools
- schema
- generation HTML
- generation PDF continue

---

## Frontieres Techniques

## Ce qui reste cote navigateur

- edition
- preview
- feedback visuel
- export HTML navigateur
- import/export JSON navigateur
- impression utilisateur via navigateur

## Ce qui reste cote Node

- rendu PDF headless
- validation headless
- schema JSON
- exposition MCP
- ecriture de fichiers PDF temporaires

## Regle De Separation

Le front ne doit pas importer de code Node-only.

En particulier :

- pas de `playwright-core` dans le bundle web
- pas de `fs` / `node:*` dans l'UI

---

## Points D'Entree

## UI

- [main.ts](./src/main.ts)

## MCP

- [server.ts](./src/mcp/server.ts)

## Smoke PDF

- [smoke-pdf.ts](./scripts/smoke-pdf.ts)

---

## Commandes Principales

### Lancer l'UI

```powershell
npm.cmd run dev
```

### Build

```powershell
npm.cmd run build
```

### Tests

```powershell
npm.cmd test
```

### Lancer le MCP

```powershell
npm.cmd run mcp
```

### Smoke PDF pagine

```powershell
npm.cmd run smoke:pdf
```

### Smoke PDF continu

```powershell
$env:CV_PDF_MODE="continuous"
npm.cmd run smoke:pdf
```

---

## Cycle De Vie D'Un CV

```mermaid
flowchart TD
    A[Creation / edition] --> B[Etat CvData]
    B --> C[Normalisation]
    C --> D[Validation]
    D --> E[HTML]
    D --> F[PDF]
    D --> G[MCP Response]

    classDef lifecycle fill:#EBF8EF,stroke:#3DA35D,color:#183D22,stroke-width:2px;
    class A,B,C,D,E,F,G lifecycle;
```

---

## Resume

L'application fonctionne comme suit :

- la UI web edite un `CvData`
- le moteur transforme ce `CvData` en HTML, PDF ou validation
- le serveur MCP expose ce moteur a un agent externe

Le coeur du systeme est donc :

- **le modele `CvData`**
- **la facade `engine/service.ts`**

Et les deux consommateurs principaux sont :

- **l'UI**
- **le MCP**

L'architecture est aussi pensee pour rester compatible avec d'autres couches d'appel locales, par exemple :

- un wrapper CLI
- un bridge MCP pour LM Studio
- d'autres clients capables de lancer un process local
