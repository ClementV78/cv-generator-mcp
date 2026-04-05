# CV Generator

Generateur de CV avec :

- une **UI web locale** pour l'edition humaine
- un **moteur Node** pour le rendu et la validation
- un **serveur MCP local** pour l'usage par LLM / agents

Le coeur public du projet est `engine + MCP`.
L'UI reste incluse pour un usage local, mais ce n'est pas l'interface principale du produit communautaire.

## Ce que fait le projet

- genere un CV HTML a partir d'un JSON `CvData`
- genere un CV PDF headless
- valide la structure et la pagination d'un CV
- expose ces capacites via MCP local

Tools MCP publics :

- `generate_cv_html`
- `generate_cv_pdf`
- `validate_cv`
- `get_cv_schema`

## Deux usages

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

Important :

- le tool n'appelle jamais l'UI
- il appelle le moteur Node
- le serveur MCP tourne en `stdio`, pas en HTTP

## Prerequis

- Node.js
- dependances npm installees
- Chrome / Edge local pour le rendu PDF headless

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

### Serveur MCP

```powershell
npm.cmd run mcp
```

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
- `pdf_mode` est un parametre du tool PDF, pas un champ metier du CV

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
    "pdf_mode": "paginated"
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

### `generate_cv_pdf`

Genere un PDF via Playwright avec :

- `pdf_mode: "paginated"` pour un CV classique
- `pdf_mode: "continuous"` pour un export monobloc plus oriente lecture ecran

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
