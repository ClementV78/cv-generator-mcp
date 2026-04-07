# CV Generator

Generateur de CV avec :

- une **UI web locale** pour l'edition humaine
- un **moteur Node** pour le rendu et la validation
- un **serveur MCP local** pour l'usage par LLM / agents
- une **CLI locale** pour scripts et integrations hors chat MCP

Le coeur public du projet est `engine + MCP`.
L'UI et la CLI restent incluses pour un usage local, mais la surface agent publique reste prioritairement `MCP`.

## Ce que fait le projet

- genere un CV HTML a partir d'un JSON `CvData`
- genere un CV PDF headless
- valide la structure et la pagination d'un CV
- expose ces capacites via MCP local et CLI locale

Tools MCP publics :

- `generate_cv_html`
- `generate_cv_pdf`
- `validate_cv`
- `get_cv_schema`

Tools MCP additionnels (workflow gros payloads) :

- `start_cv_chunked_generation`
- `append_cv_generation_chunk`

## Trois usages

### 1. Usage local humain

Editeur web pour :

- modifier le contenu
- choisir le theme
- regler la sidebar
- importer/exporter du JSON
- previsualiser le rendu

### 2. Usage LLM / agent

Serveur MCP local pour :

- valider un `CvData`
- generer du HTML
- generer du PDF `paginated | continuous`
- recuperer le schema JSON
- generer en mode chunked quand `cv_data` depasse 5000 caracteres

Important :

- le tool n'appelle jamais l'UI
- il appelle le moteur Node
- le serveur MCP tourne en `stdio`, pas en HTTP

### 3. Usage script / terminal

CLI locale alignee sur la surface MCP pour :

- recuperer le schema `CvData`
- valider un fichier `cv_data` JSON
- generer un HTML
- generer un PDF `paginated | continuous`

## Prerequis

- Node.js
- dependances npm installees
- aucun chemin de navigateur systeme a fournir dans le flux MCP normal

## Installation

```powershell
npm.cmd install
```

## Commandes principales

### UI locale

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

### Smoke test PDF

```powershell
npm.cmd run smoke:pdf
```

Mode PDF continu :

```powershell
$env:CV_PDF_MODE="continuous"
npm.cmd run smoke:pdf
```

Forcer un navigateur systeme specifique (optionnel) :

```powershell
$env:CV_BROWSER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
npm.cmd run smoke:pdf
```

### Serveur MCP

```powershell
npm.cmd run mcp
```

### CLI locale (meme surface que MCP)

```powershell
npm.cmd run cli -- --help
```

Schema:

```powershell
npm.cmd run cli -- get-cv-schema
```

Validation:

```powershell
npm.cmd run cli -- validate-cv --cv-data .\examples\cv-minimal.json
```

Generation HTML:

```powershell
npm.cmd run cli -- generate-cv-html --cv-data .\examples\cv-minimal.json --output .\cv-output.html
```

Generation PDF:

```powershell
npm.cmd run cli -- generate-cv-pdf --cv-data .\examples\cv-minimal.json --pdf-mode paginated --output .\cv-output.pdf
```

Options alignees MCP:

- `--pdf-mode` / `--pdf_mode` (`paginated | continuous`)
- `--browser-executable-path` / `--browser_executable_path`
- `--cv-data` / `--cv_data` / `--input`

## Exemples JSON

Des exemples publics sont fournis dans `examples/` :

- `examples/cv-minimal.json`
- `examples/cv-devops.json`
- `examples/cv-java.json`
- `examples/cv-sophro.json`

## Contrat d'entree

Le contrat principal reste `CvData`.

Les regles utiles a retenir :

- les parametres metier et de rendu vivent dans `cv_data`
- `theme`, `sidebarPosition` et `maxPages` vivent dans `cv_data.render`
- `pdf_mode` et `browser_executable_path` (optionnel) sont des parametres d'execution des tools MCP, pas des champs metier du CV

Exemple :

```json
{
  "cv_data": {
    "render": {
      "theme": "ocean",
      "sidebarPosition": "left",
      "maxPages": 2
    }
  },
  "pdf_mode": "paginated"
}
```

## Exemples d'usage logique

### Validation

Le client MCP envoie :

```json
{
  "cv_data": {
    "header": {
      "name": "Alex Martin",
      "badgeText": "A.M",
      "headline": "DEVOPS | CLOUD | AUTOMATION",
      "location": "Paris, France",
      "email": "alex.martin@example.com",
      "linkedin": "linkedin.com/in/alex-martin",
      "availabilityText": "Disponible pour des missions DevOps et Cloud",
      "qrCodeLabel": "Version web",
      "qrCodeUrl": "https://example.com/cv/alex-martin",
      "showQrCode": true
    },
    "profileLabel": "Profil professionnel",
    "profile": "Ingenieur DevOps avec experience en automatisation, CI/CD et cloud public.",
    "skillGroups": [],
    "highlights": [],
    "certifications": [],
    "formations": [],
    "languages": [],
    "experiences": [],
    "mainEducation": {
      "enabled": true,
      "title": "Formation",
      "summary": "Master Informatique."
    },
    "render": {
      "mode": "preview",
      "maxPages": 2,
      "theme": "ocean",
      "sidebarPosition": "left"
    }
  }
}
```

### Generation HTML

Tool :

```json
{
  "name": "generate_cv_html",
  "arguments": {
    "cv_data": {}
  }
}
```

### Generation PDF

Tool :

```json
{
  "name": "generate_cv_pdf",
  "arguments": {
    "cv_data": {},
    "pdf_mode": "paginated",
    "browser_executable_path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  }
}
```

Ou :

```json
{
  "name": "generate_cv_pdf",
  "arguments": {
    "cv_data": {},
    "pdf_mode": "continuous"
  }
}
```

## Tools MCP

### `get_cv_schema`

Retourne le JSON Schema du contrat `CvData`.

### `validate_cv`

Valide un `CvData`, normalise l'entree et retourne :

- `page_count`
- `page_limit_exceeded`
- `issues`
- `structure_messages`
- `normalized_cv_data`

### `generate_cv_html`

Genere le HTML final du CV sans chrome d'edition.

Limite appel direct :

- `cv_data` stringify <= `5000` caracteres
- sinon, utiliser le workflow chunked

### `generate_cv_pdf`

Genere un PDF via `Vivliostyle` a partir du HTML/CSS du template :

- `pdf_mode: "paginated"` pour un CV classique
- `pdf_mode: "continuous"` pour un export monobloc plus oriente lecture ecran

Limite appel direct :

- `cv_data` stringify <= `5000` caracteres
- sinon, utiliser le workflow chunked

### `start_cv_chunked_generation`

Ouvre une session chunked et retourne un `upload_id`.

Parametres :

- `output_format: "pdf" | "html"` (defaut `pdf`)
- `pdf_mode: "paginated" | "continuous"` (utilise seulement pour `pdf`)
- `browser_executable_path` (optionnel)

### `append_cv_generation_chunk`

Ajoute un fragment JSON a une session chunked.

Parametres :

- `upload_id`
- `chunk_index` (0-based)
- `total_chunks`
- `chunk` (<= `5000` caracteres)

Comportement :

- tant que tous les chunks ne sont pas recus: reponse `upload_completed: false`
- au dernier chunk: reassemblage JSON + validation + generation automatique (`html` ou `pdf`)

Notes utiles :

- le backend PDF principal est `@vivliostyle/cli`
- le rendu est donc beaucoup plus proche du HTML/CSS source que l'ancien PDF reconstruit a la main
- le tool MCP ne demande pas de chemin de navigateur systeme dans le cas nominal
- `browser_executable_path` reste disponible en override optionnel si l'environnement headless local est incomplet
- le premier rendu PDF peut etre plus lent, le temps que le runtime headless soit pret
- le choix de ce backend implique aussi de surveiller sa licence et son impact de distribution

## Limite de taille pour la generation MCP

Pour `generate_cv_html` et `generate_cv_pdf` :

- le serveur refuse les appels directs si `JSON.stringify(cv_data).length > 5000`
- code d'erreur : `cv_data_too_large_for_single_call`

Workflow recommande pour les gros CV :

1. `start_cv_chunked_generation`
2. `append_cv_generation_chunk` pour chaque fragment (`chunk_index` de `0` a `total_chunks - 1`)
3. le serveur finalise automatiquement au dernier chunk

## Comportement en cas de depassement de pages

Si `cv_data.render.maxPages` est defini et que le rendu le depasse :

- `validate_cv` retourne `page_limit_exceeded: true`
- `generate_cv_html` retourne une erreur structuree
- `generate_cv_pdf` retourne une erreur structuree en mode `paginated`
- `generate_cv_pdf` reste autorise en mode `continuous`

## Compatibilite cible

Le projet est concu d'abord pour :

- Claude Agent SDK
- OpenClaw / NanoClaw
- LM Studio via wrapper / bridge MCP adequat

L'idee cle :

- le moteur est independant
- le MCP est la couche d'exposition principale

## Documentation

Documents principaux :

- [Architecture applicative](./APPLICATION_ARCHITECTURE_CV_GENERATOR.md)

## Etat de la beta V1

Beta V1 = projet publiable sur GitHub avec :

- moteur Node fonctionnel
- serveur MCP local
- UI locale conservee
- exemples JSON
- build et tests reproductibles

Ce n'est pas encore :

- un package npm public
- un conteneur Docker officiel
- un produit avec compatibilite garantie sur tous les environnements

## Licence

MIT

Note :

- le projet est sous licence `MIT`
- certaines dependances peuvent avoir leur propre licence ; en particulier, le backend PDF actuel `@vivliostyle/cli` doit etre verifie avant une publication communautaire plus large
