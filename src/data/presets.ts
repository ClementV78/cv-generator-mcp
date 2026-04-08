import { normalizeCvData } from "../model";
import type { CvData } from "../types";

export type PresetKey =
  | "cloud-architect"
  | "java-developer"
  | "devops"
  | "soc-engineer"
  | "sophrologue-trainer";

export const presets: Record<PresetKey, CvData> = {
  "cloud-architect": normalizeCvData({
    header: {
      name: "Clara Nimbus",
      badgeText: "C.N",
      headline: "CLOUD ARCHITECT | AWS | AZURE | MODERN PLATFORMS",
      location: "Lyon, France",
      email: "clara.nimbus@example.com",
      linkedin: "linkedin.com/in/clara-nimbus",
      availabilityText: "Disponible pour des missions d'architecture Cloud et de cadrage technique",
      qrCodeLabel: "Version web",
      qrCodeUrl: "https://example.com/cloud-architect",
      showQrCode: true,
    },
    profileLabel: "Profil professionnel",
    profile:
      "Cloud Architect avec experience en architecture de plateformes, migration vers le Cloud, gouvernance technique et accompagnement d'equipes produit autour d'AWS, Azure, IaC et securite.",
    skillGroups: [
      {
        title: "Cloud & Architecture",
        type: "bars",
        items: [
          { label: "Architecture AWS", level: 88 },
          { label: "Architecture Azure", level: 76 },
          { label: "Conception de plateformes", level: 90 },
          { label: "Terraform / IaC", level: 84 },
          { label: "Gouvernance technique", level: 79 },
        ],
      },
      {
        title: "Langages & Outils",
        type: "tags",
        items: [
          { label: "Terraform" },
          { label: "AWS" },
          { label: "Azure" },
          { label: "Kubernetes" },
          { label: "Grafana" },
          { label: "API Gateway" },
        ],
      },
    ],
    highlights: [
      { text: "Architecture de plateformes Cloud et hybrides." },
      { text: "Cadrage technique, roadmap et gouvernance." },
    ],
    certifications: [
      { icon: "certification", title: "AWS Solutions Architect Associate", subtitle: "2025" },
    ],
    formations: [
      { icon: "formation", title: "Master Informatique", subtitle: "2014", meta: "Architecture & systemes" },
    ],
    languages: [
      { title: "Francais", subtitle: "langue maternelle" },
      { title: "Anglais", subtitle: "courant professionnel" },
    ],
    experiences: [
      {
        company: "Helios Retail",
        role: "Cloud Architect",
        period: "2023 - 2026",
        subtitle: "Programme de transformation Cloud",
        bullets: [
          { text: "Definition d'une cible d'architecture AWS pour plusieurs domaines produit." },
          { text: "Mise en place des standards IaC, securite, reseau et observabilite." },
          { text: "Accompagnement des equipes dans la migration et la modernisation applicative." },
          { text: "Animation des arbitrages techniques et contribution a la feuille de route plateforme." },
        ],
        techEnvironmentLabel: "Environnement technique",
        techEnvironment:
          "AWS, Azure, Terraform, Kubernetes, GitHub Actions, Grafana, IAM, Networking",
        projects: [
          {
            title: "Socle d'integration produit",
            period: "2024 - 2026",
            bullets: [
              { text: "Definition des standards d'exposition d'API et des patterns de securite." },
              { text: "Accompagnement des equipes sur l'industrialisation des deploiements." },
            ],
            techEnvironmentLabel: "Environnement technique",
            techEnvironment: "AWS, API Gateway, IAM, Terraform, GitHub Actions",
          },
        ],
      },
      {
        company: "Nova Services",
        role: "Consultante architecture technique",
        period: "2019 - 2023",
        subtitle: "Plateforme de services B2B",
        bullets: [
          { text: "Conception d'une architecture cible orientee APIs et microservices." },
          { text: "Travail avec les equipes securite, ops et produit pour cadrer les solutions." },
          { text: "Participation aux choix de trajectoire de migration et de decouplage applicatif." },
        ],
        techEnvironmentLabel: "Environnement technique",
        techEnvironment: "AWS, API Gateway, Java, Kubernetes, PostgreSQL",
        projects: [
          {
            title: "Plateforme de services partenaires",
            period: "2021 - 2023",
            bullets: [
              { text: "Cadrage des flux B2B et des besoins de securisation des integrations." },
            ],
            techEnvironmentLabel: "Environnement technique",
            techEnvironment: "AWS, Kubernetes, PostgreSQL, REST API",
          },
        ],
      },
    ],
    mainEducation: {
      enabled: true,
      title: "Formation",
      summary: "Master informatique et certifications Cloud. Formation continue autour d'AWS, Terraform et securite.",
    },
    render: { mode: "edit", maxPages: 2, theme: "ocean", sidebarPosition: "left", language: "french" },
  }),
  "java-developer": normalizeCvData({
    header: {
      name: "Jules Spring",
      badgeText: "J.S",
      headline: "DEVELOPPEUR JAVA | SPRING | BACKEND | API",
      location: "Lille, France",
      email: "jules.spring@example.com",
      linkedin: "linkedin.com/in/jules-spring",
      availabilityText: "Disponible pour des missions de developpement backend Java",
      qrCodeLabel: "Version web",
      qrCodeUrl: "https://example.com/java-developer",
      showQrCode: true,
    },
    profileLabel: "Profil professionnel",
    profile:
      "Developpeur Java backend avec experience en conception technique, APIs, microservices et maintenance evolutive. Habitude des contextes produit, de la qualite logicielle et du travail en equipe agile.",
    skillGroups: [
      {
        title: "Developpement backend",
        type: "bars",
        items: [
          { label: "Java", level: 92 },
          { label: "Spring Boot", level: 88 },
          { label: "Conception d'API", level: 84 },
          { label: "Tests automatises", level: 81 },
          { label: "SQL / modelisation", level: 78 },
        ],
      },
      {
        title: "Langages & Outils",
        type: "tags",
        items: [
          { label: "Java" },
          { label: "Spring Boot" },
          { label: "JUnit" },
          { label: "PostgreSQL" },
          { label: "Maven" },
          { label: "Docker" },
        ],
      },
    ],
    highlights: [
      { text: "Developpement backend Java et APIs." },
      { text: "Conception technique et qualite logicielle." },
    ],
    certifications: [
      { icon: "certification", title: "Oracle Java SE", subtitle: "2023" },
    ],
    formations: [
      { icon: "formation", title: "Master Genie Logiciel", subtitle: "2017", meta: "Developpement logiciel" },
    ],
    languages: [
      { title: "Francais", subtitle: "langue maternelle" },
      { title: "Anglais", subtitle: "lu, ecrit, parle" },
    ],
    experiences: [
      {
        company: "Atlas Payments",
        role: "Developpeur Java / Spring",
        period: "2022 - 2026",
        subtitle: "Plateforme de services de paiement",
        bullets: [
          { text: "Developpement de services backend Java / Spring Boot exposes via APIs REST." },
          { text: "Prise en charge de correctifs, evolutions et ameliorations de performance." },
          { text: "Ajout de tests automatises et participation a l'amelioration du delivery." },
          { text: "Collaboration avec les equipes produit et QA pour cadrer les evolutions prioritaires." },
        ],
        techEnvironmentLabel: "Environnement technique",
        techEnvironment: "Java, Spring Boot, PostgreSQL, Kafka, Docker, GitLab CI",
        projects: [
          {
            title: "API de gestion des flux de paiement",
            period: "2024 - 2026",
            bullets: [
              { text: "Conception et evolution d'API REST backend avec exigences de performance." },
              { text: "Ajout de tests d'integration et fiabilisation des traitements asynchrones." },
            ],
            techEnvironmentLabel: "Environnement technique",
            techEnvironment: "Java, Spring Boot, PostgreSQL, Kafka",
          },
        ],
      },
      {
        company: "Opale Assurances",
        role: "Concepteur developpeur Java",
        period: "2018 - 2022",
        subtitle: "Applications metier assurance",
        bullets: [
          { text: "Conception et developpement de modules metier en Java." },
          { text: "Participation aux ateliers techniques et au support des mises en production." },
          { text: "Maintenance evolutive et resolution d'incidents en lien avec les equipes fonctionnelles." },
        ],
        techEnvironmentLabel: "Environnement technique",
        techEnvironment: "Java, Spring, Oracle, Maven, Jenkins",
        projects: [
          {
            title: "Services de tarification",
            period: "2019 - 2022",
            bullets: [
              { text: "Contribution aux composants de calcul et aux traitements batch applicatifs." },
            ],
            techEnvironmentLabel: "Environnement technique",
            techEnvironment: "Java, Spring, Oracle, Jenkins",
          },
        ],
      },
      {
        company: "Pixel Commerce",
        role: "Developpeur backend",
        period: "2015 - 2018",
        subtitle: "Plateforme e-commerce",
        bullets: [
          { text: "Developpement de services backend et maintenance des flux applicatifs." },
          { text: "Participation aux evolutions de performance et au support de production." },
        ],
        techEnvironmentLabel: "Environnement technique",
        techEnvironment: "Java, Spring MVC, MySQL, Maven, Tomcat",
        projects: [],
      },
    ],
    mainEducation: {
      enabled: true,
      title: "Formation",
      summary: "Master genie logiciel, bases solides en algorithmique, modelisation, developpement Java et bases de donnees.",
    },
    render: { mode: "edit", maxPages: 2, theme: "claude", sidebarPosition: "left", language: "french" },
  }),
  devops: normalizeCvData({
    header: {
      name: "Diane Ops",
      badgeText: "D.O",
      headline: "DEVOPS ENGINEER | CLOUD PLATFORM | AUTOMATION",
      location: "Paris, France",
      email: "diane.ops@example.com",
      linkedin: "linkedin.com/in/diane-ops",
      availabilityText: "Disponible pour des missions DevOps, plateforme et automatisation",
      qrCodeLabel: "Version web",
      qrCodeUrl: "https://example.com/devops",
      showQrCode: true,
    },
    profileLabel: "Profil professionnel",
    profile:
      "Ingenieur DevOps avec experience sur l'automatisation des plateformes, l'industrialisation CI/CD, la conteneurisation, l'observabilite et l'exploitation de services Cloud en environnement produit.",
    skillGroups: [
      {
        title: "Cloud & Plateforme",
        type: "bars",
        items: [
          { label: "AWS", level: 78 },
          { label: "Kubernetes / EKS / k3s", level: 74 },
          { label: "Architecture de plateforme", level: 80 },
          { label: "Terraform / IaC", level: 81 },
          { label: "CI/CD", level: 86 },
          { label: "Observabilite", level: 73 },
        ],
      },
      {
        title: "Langages & Outils",
        type: "tags",
        items: [
          { label: "Terraform" },
          { label: "GitHub Actions" },
          { label: "Docker" },
          { label: "Kubernetes" },
          { label: "Prometheus" },
          { label: "Grafana" },
          { label: "Python" },
        ],
      },
    ],
    highlights: [
      { text: "Automatisation et industrialisation des plateformes." },
      { text: "CI/CD, IaC et observabilite." },
    ],
    certifications: [
      { icon: "certification", title: "AWS Solutions Architect Associate", subtitle: "2025" },
      { icon: "certification", title: "KCNA", subtitle: "2025" },
    ],
    formations: [
      { icon: "formation", title: "Bootcamp DevOps", subtitle: "2024", meta: "Cloud, IaC, CI/CD" },
    ],
    languages: [
      { title: "Francais", subtitle: "langue maternelle" },
      { title: "Anglais", subtitle: "courant professionnel" },
    ],
    experiences: [
      {
        company: "Northstar Mobility",
        role: "DevOps Engineer",
        period: "2023 - 2026",
        subtitle: "Plateforme de services connectes",
        bullets: [
          { text: "Mise en place et evolution des pipelines CI/CD et de l'IaC de la plateforme." },
          { text: "Support des equipes applicatives sur les deploiements, la conteneurisation et l'observabilite." },
          { text: "Participation a la fiabilisation de l'exploitation et a la reduction du temps de livraison." },
          { text: "Contribution a la standardisation des environnements et des runbooks de delivery." },
        ],
        techEnvironmentLabel: "Environnement technique",
        techEnvironment: "AWS, Terraform, Kubernetes, Docker, GitHub Actions, Prometheus, Grafana",
        projects: [
          {
            title: "Socle CI/CD mutualise",
            period: "2024 - 2026",
            bullets: [
              { text: "Creation de pipelines templates reutilisables pour plusieurs equipes applicatives." },
              { text: "Ajout de controles qualite et d'etapes de deploiement standardisees." },
            ],
            techEnvironmentLabel: "Environnement technique",
            techEnvironment: "GitHub Actions, Docker, Terraform, Kubernetes",
          },
        ],
      },
      {
        company: "Silverline Media",
        role: "Ingenieur plateforme",
        period: "2020 - 2023",
        subtitle: "Environnement cloud-native",
        bullets: [
          { text: "Automatisation d'environnements et standardisation des deploiements." },
          { text: "Mise en place de tableaux de bord, alerting et processus d'exploitation." },
          { text: "Appui aux equipes de developpement sur les sujets de release et d'exploitation Cloud." },
        ],
        techEnvironmentLabel: "Environnement technique",
        techEnvironment: "AWS, Linux, Shell, Python, Grafana, PostgreSQL",
        projects: [
          {
            title: "Observabilite plateforme",
            period: "2021 - 2023",
            bullets: [
              { text: "Mise en place de dashboards, alertes et bonnes pratiques de supervision." },
            ],
            techEnvironmentLabel: "Environnement technique",
            techEnvironment: "Grafana, Prometheus, AWS, PostgreSQL",
          },
        ],
      },
      {
        company: "Blue Orbit",
        role: "Administratrice systeme & automation",
        period: "2018 - 2020",
        subtitle: "Socle Linux et scripts d'exploitation",
        bullets: [
          { text: "Automatisation de taches recurrentes et support des environnements Linux." },
          { text: "Participation a l'industrialisation des mises en service et au support operationnel." },
        ],
        techEnvironmentLabel: "Environnement technique",
        techEnvironment: "Linux, Shell, Python, Ansible, VMware",
        projects: [],
      },
    ],
    mainEducation: {
      enabled: true,
      title: "Formation",
      summary: "Formation continue orientee DevOps, Cloud, automatisation, exploitation et outillage plateforme.",
    },
    render: { mode: "edit", maxPages: 2, theme: "ocean", sidebarPosition: "left", language: "french" },
  }),
  "soc-engineer": normalizeCvData({
    header: {
      name: "Sam IEM",
      badgeText: "S.I",
      headline: "INGENIEUR SOC | DETECTION | INCIDENT RESPONSE | SIEM",
      location: "Toulouse, France",
      email: "sam.iem@example.com",
      linkedin: "linkedin.com/in/sam-iem",
      availabilityText: "Disponible pour des missions SOC, detection et reponse a incident",
      qrCodeLabel: "Version web",
      qrCodeUrl: "https://example.com/soc-engineer",
      showQrCode: true,
    },
    profileLabel: "Profil professionnel",
    profile:
      "Ingenieure SOC avec experience en supervision securite, triage d'alertes, investigation, durcissement des regles de detection et coordination avec les equipes infra, poste de travail et reseau.",
    skillGroups: [
      {
        title: "SOC & Detection",
        type: "bars",
        items: [
          { label: "SIEM", level: 85 },
          { label: "Triage & investigation", level: 82 },
          { label: "Detection engineering", level: 78 },
          { label: "Incident response", level: 74 },
          { label: "Runbooks & process", level: 79 },
        ],
      },
      {
        title: "Langages & Outils",
        type: "tags",
        items: [
          { label: "Splunk" },
          { label: "Microsoft Sentinel" },
          { label: "EDR" },
          { label: "Sigma" },
          { label: "KQL" },
          { label: "Windows" },
          { label: "Linux" },
        ],
      },
    ],
    highlights: [
      { text: "Supervision securite et investigation d'alertes." },
      { text: "Amelioration des regles de detection." },
    ],
    certifications: [
      { icon: "certification", title: "SC-200", subtitle: "2025" },
      { icon: "certification", title: "Security+", subtitle: "2024" },
    ],
    formations: [
      { icon: "formation", title: "Master Cybersecurite", subtitle: "2020", meta: "Detection & defense" },
    ],
    languages: [
      { title: "Francais", subtitle: "langue maternelle" },
      { title: "Anglais", subtitle: "courant professionnel" },
    ],
    experiences: [
      {
        company: "Aster Telecom",
        role: "Ingenieure SOC",
        period: "2022 - 2026",
        subtitle: "Centre de supervision securite",
        bullets: [
          { text: "Analyse et qualification des alertes SIEM et EDR." },
          { text: "Participation aux investigations, remediations et rapports d'incident." },
          { text: "Amelioration continue des cas de detection et des runbooks d'escalade." },
          { text: "Coordination avec les equipes infra et poste de travail lors des incidents prioritaires." },
        ],
        techEnvironmentLabel: "Environnement technique",
        techEnvironment: "Splunk, Sentinel, EDR, KQL, Sigma, Windows, Linux",
        projects: [
          {
            title: "Amelioration des cas de detection",
            period: "2024 - 2026",
            bullets: [
              { text: "Revue des alertes bruitees et ajustement des regles de detection." },
              { text: "Ajout de playbooks d'analyse pour accelerer la qualification." },
            ],
            techEnvironmentLabel: "Environnement technique",
            techEnvironment: "SIEM, EDR, KQL, Sigma",
          },
        ],
      },
      {
        company: "Hexa Industrie",
        role: "Analyste securite",
        period: "2020 - 2022",
        subtitle: "Supervision et gestion des incidents",
        bullets: [
          { text: "Suivi des alertes, analyse initiale et escalade vers les equipes concernees." },
          { text: "Contribution a la documentation d'investigation et a l'amelioration des controles." },
          { text: "Participation aux exercices de remontee d'alertes et a la capitalisation des retours d'incident." },
        ],
        techEnvironmentLabel: "Environnement technique",
        techEnvironment: "SIEM, EDR, Active Directory, Windows, Linux",
        projects: [
          {
            title: "Runbooks d'escalade",
            period: "2021 - 2022",
            bullets: [
              { text: "Mise a jour des procedures de qualification et de remontee d'incidents." },
            ],
            techEnvironmentLabel: "Environnement technique",
            techEnvironment: "SIEM, EDR, Windows, Linux",
          },
        ],
      },
      {
        company: "Lumen Conseil",
        role: "Analyste cyber junior",
        period: "2018 - 2020",
        subtitle: "Support de supervision securite",
        bullets: [
          { text: "Suivi des evenements de securite et preparation des premiers elements d'analyse." },
          { text: "Contribution a la mise a jour des tableaux de bord de supervision." },
        ],
        techEnvironmentLabel: "Environnement technique",
        techEnvironment: "SIEM, Windows, Linux, Active Directory",
        projects: [],
      },
    ],
    mainEducation: {
      enabled: true,
      title: "Formation",
      summary: "Formation initiale cybersecurite et certifications orientees SOC, detection et reponse a incident.",
    },
    render: { mode: "edit", maxPages: 2, theme: "cyber", sidebarPosition: "left", language: "french" },
  }),
  "sophrologue-trainer": normalizeCvData({
    header: {
      name: "Sonia Respire",
      badgeText: "S.R",
      headline: "SOPHROLOGUE | FORMATRICE EN SOPHROLOGIE | ACCOMPAGNEMENT",
      location: "Nantes, France",
      email: "sonia.respire@example.com",
      linkedin: "linkedin.com/in/sonia-respire",
      availabilityText: "Disponible pour des accompagnements individuels, ateliers collectifs et formations en sophrologie",
      qrCodeLabel: "Version web",
      qrCodeUrl: "https://example.com/sophrologue-formatrice",
      showQrCode: true,
    },
    profileLabel: "Profil professionnel",
    profile:
      "Sophrologue et formatrice en sophrologie, avec experience en accompagnement individuel, animation d'ateliers collectifs et conception de parcours pedagogiques autour de la gestion du stress, de la regulation emotionnelle et de la qualite de vie au travail.",
    skillGroups: [
      {
        title: "Accompagnement & animation",
        type: "bars",
        items: [
          { label: "Accompagnement individuel", level: 88 },
          { label: "Animation de groupes", level: 84 },
          { label: "Conception de parcours", level: 82 },
          { label: "Pedagogie", level: 85 },
        ],
      },
      {
        title: "Outils & cadres d'intervention",
        type: "tags",
        items: [
          { label: "Sophrologie" },
          { label: "Relaxation dynamique" },
          { label: "QVT" },
          { label: "Ateliers collectifs" },
          { label: "Formation" },
          { label: "Prevention du stress" },
        ],
      },
    ],
    highlights: [
      { text: "Accompagnements individuels et ateliers collectifs." },
      { text: "Formation en sophrologie et transmission de pratiques." },
    ],
    certifications: [
      { icon: "certification", title: "Certification de sophrologue", subtitle: "2024" },
    ],
    formations: [
      { icon: "formation", title: "Formation de sophrologue", subtitle: "2024", meta: "Pratique professionnelle" },
      { icon: "formation", title: "Formation de formateur", subtitle: "2022", meta: "Pedagogie & animation" },
    ],
    languages: [
      { title: "Francais", subtitle: "langue maternelle" },
      { title: "Anglais", subtitle: "niveau conversationnel" },
    ],
    experiences: [
      {
        company: "Cabinet Equilibre",
        role: "Sophrologue & formatrice",
        period: "2023 - 2026",
        subtitle: "Accompagnements, ateliers et formations",
        bullets: [
          { text: "Animation de seances individuelles et de cycles d'accompagnement autour du stress, du sommeil et de la confiance en soi." },
          { text: "Conception et animation d'ateliers collectifs en entreprise et en structure associative." },
          { text: "Creation de supports et de parcours de formation en sophrologie pour des publics debutants." },
          { text: "Adaptation des contenus selon les besoins, le contexte et les objectifs des participants." },
        ],
        techEnvironmentLabel: "Cadre d'intervention",
        techEnvironment: "Sophrologie, ateliers collectifs, accompagnement individuel, formation, QVT",
        projects: [
          {
            title: "Programme gestion du stress en entreprise",
            period: "2024 - 2026",
            bullets: [
              { text: "Construction d'un cycle de plusieurs ateliers autour de la respiration, de la recuperation et de la concentration." },
              { text: "Animation de sessions collectives et ajustement des exercices selon les retours terrain." },
            ],
            techEnvironmentLabel: "Cadre d'intervention",
            techEnvironment: "Ateliers collectifs, sophrologie, prevention du stress",
          },
          {
            title: "Parcours d'initiation a la sophrologie",
            period: "2023 - 2025",
            bullets: [
              { text: "Structuration d'un module de formation pour faire decouvrir les bases et les champs d'application de la sophrologie." },
            ],
            techEnvironmentLabel: "Cadre d'intervention",
            techEnvironment: "Formation, pedagogie, supports d'animation",
          },
        ],
      },
      {
        company: "Centre Mieux Vivre",
        role: "Animatrice bien-etre",
        period: "2020 - 2023",
        subtitle: "Ateliers de groupe et accompagnement prealable a la specialisation",
        bullets: [
          { text: "Animation d'ateliers de relaxation et de pratique corporelle douce pour differents publics." },
          { text: "Participation a la preparation des seances, a l'accueil des participants et au suivi des besoins exprimes." },
          { text: "Contribution a la construction progressive d'une posture d'accompagnement et d'animation." },
        ],
        techEnvironmentLabel: "Cadre d'intervention",
        techEnvironment: "Animation de groupes, relaxation, accompagnement, bien-etre",
        projects: [],
      },
    ],
    mainEducation: {
      enabled: true,
      title: "Formation",
      summary: "Formation de sophrologue completee par une formation de formateur, avec pratique d'animation, construction de supports et adaptation pedagogique selon les publics.",
    },
    render: { mode: "edit", maxPages: 2, theme: "zen", sidebarPosition: "left", language: "french" },
  }),
};
