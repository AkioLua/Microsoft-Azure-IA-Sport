# Azure ML Sport - Coach IA Multi-Agent

Projet d'IA sportive construit avec les ressources **Microsoft Azure**.  
L'application combine un tableau de bord de prediction de blessure avec un coach sportif IA multi-agent base sur **Azure AI Foundry** et **Azure Machine Learning**.

## Objectif

Ce projet propose deux experiences principales :

- **Prediction blessure** : formulaire d'inference connecte a un endpoint Azure ML pour estimer un risque de blessure.
- **Sport Coach Agent IA** : chatbot de coaching sportif qui route les demandes vers des agents specialises.

Le systeme est concu autour de plusieurs agents :

- `Coach-IA-Assitant` : orchestrateur qui analyse l'intention utilisateur.
- `NutritionAgent` : conseils nutrition, repas, macros, perte ou prise de masse.
- `FitnessAgent` : programmes sportifs, musculation, cardio, recuperation.
- `FaqAgent` : questions generales sur le fonctionnement du coach IA.

## Architecture Generale

```mermaid
flowchart LR
    U[Utilisateur] --> UI[Application React / Vite]

    UI --> Settings[Settings sessionStorage]
    Settings --> Tokens[Token Azure ML + Token Foundry]

    UI --> Injury[Dashboard Prediction Blessure]
    Injury --> AML[Endpoint Azure Machine Learning]
    AML --> Score[Score risque blessure]
    Score --> UI

    UI --> Coach[Chatbot Sport Coach Agent IA]
    Coach --> WF[Azure AI Foundry Workflow]
    WF --> Orchestrator[Coach-IA-Assitant]
    Orchestrator --> Nutrition[NutritionAgent]
    Orchestrator --> Fitness[FitnessAgent]
    Orchestrator --> FAQ[FaqAgent]
    Nutrition --> Coach
    Fitness --> Coach
    FAQ --> Coach
```

## Workflow Multi-Agent Azure AI Foundry

Le workflow Foundry commence a chaque nouvelle conversation.  
Il capture le message utilisateur, appelle l'orchestrateur, puis route vers l'agent specialise selon le champ `agent` renvoye.

```mermaid
flowchart TD
    Start([Start]) --> SetVar[Definissez une variable<br/>Local.user_message]
    SetVar --> Orch[InvokeAzureAgent<br/>Coach-IA-Assitant]
    Orch --> Cond{Condition Si / Sinon}

    Cond -->|Local.route.agent = NutritionAgent| Nutrition[NutritionAgent]
    Cond -->|Local.route.agent = FitnessAgent| Fitness[FitnessAgent]
    Cond -->|Autre| Faq[FaqAgent]

    Nutrition --> End([Fin])
    Fitness --> End
    Faq --> End
```

## Pipeline Azure Machine Learning

Le pipeline Azure ML prepare les donnees, applique une selection de colonnes, execute du feature engineering, score le modele, puis expose un endpoint de service web.

```mermaid
flowchart TD
    Dataset[Dataset Injury-V3] --> Select[Select Columns in Dataset]
    Select --> Python[Execute Python Script]
    Python --> Feature[Filter Based Feature Selection]
    Feature --> Score[Score Model]

    Model[Modele entraine Injury Detection] --> Score
    WebInput[Web Service Input] --> Score

    Score --> WebOutput[Web Service Output]
    Score --> Eval[Evaluate Model]
```

## Captures de l'Application

### Chatbot Sport Coach Agent IA

![Chatbot Sport Coach Agent IA](docs/screenshots/app-chatbot.png)

### Dashboard Azure ML Injury

![Dashboard Azure ML Injury](docs/screenshots/app-dashboard.png)

## Fonctionnalites

- Interface React avec navigation laterale.
- Tableau de bord Azure ML avec metriques, historique et schema d'entree.
- Appel d'un endpoint Azure ML de scoring.
- Chatbot connectable a un workflow Azure AI Foundry.
- Page `Settings` pour renseigner les tokens dans `sessionStorage`.
- Aucun token n'est stocke dans le code source.

## Securite

Les tokens d'acces ne doivent jamais etre commits dans le repository.

Dans l'application, ils sont saisis depuis la page **Settings** et conserves uniquement dans `sessionStorage`, donc seulement pour l'onglet courant du navigateur.

Pour une mise en production, il est recommande de remplacer cette logique par un backend securise :

```mermaid
flowchart LR
    User[Utilisateur] --> Front[Frontend React]
    Front --> Backend[Backend securise]
    Backend --> ManagedIdentity[Managed Identity / Entra ID]
    Backend --> AzureFoundry[Azure AI Foundry]
    Backend --> AzureML[Azure Machine Learning]
```

## Lancer le Projet

```powershell
cd azure-injury-lab
npm install
npm run dev
```

Puis ouvrir :

```text
http://localhost:5173
```

## Build

```powershell
cd azure-injury-lab
npm run build
```

## Stack Technique

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Azure AI Foundry
- Azure Machine Learning
- Microsoft Entra ID pour l'authentification aux ressources Azure
