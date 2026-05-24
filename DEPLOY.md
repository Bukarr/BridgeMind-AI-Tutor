# Deployment guide — BridgeMind

This document provides step-by-step instructions to deploy the backend to Cloud Run, host static assets on Firebase Hosting (rewriting `/api/**` to Cloud Run), and secure `GEMINI_API_KEY` in Secret Manager. It also covers GitHub Actions CI/CD.

Prerequisites
- Install `gcloud` and authenticate: `gcloud auth login`
- Install `firebase-tools`: `npm i -g firebase-tools`
- Enable APIs: Cloud Run, Artifact Registry (or Container Registry), Secret Manager, Cloud Build, IAM

1) Create GCP resources

```bash
# Set variables
export PROJECT_ID=your-gcp-project-id
export REGION=us-central1
export SERVICE=bridgemind-backend

# Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com

# Create service account for CI
gcloud iam service-accounts create github-deployer --display-name "GitHub Actions Deployer"

# Grant roles to the SA
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:github-deployer@$PROJECT_ID.iam.gserviceaccount.com" --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:github-deployer@$PROJECT_ID.iam.gserviceaccount.com" --role="roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:github-deployer@$PROJECT_ID.iam.gserviceaccount.com" --role="roles/storage.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:github-deployer@$PROJECT_ID.iam.gserviceaccount.com" --role="roles/cloudbuild.builds.editor"

# Create Artifact Registry (optional) or use Container Registry
gcloud artifacts repositories create bridgemind-repo --repository-format=docker --location=$REGION || true
```

2) Store `GEMINI_API_KEY` in Secret Manager

```bash
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=- --replication-policy="automatic"

# Give Cloud Run runtime and deployer SA access to the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:github-deployer@$PROJECT_ID.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"

# Also allow the Cloud Run runtime service account (PROJECT_NUMBER-compute@developer.gserviceaccount.com)
RUNTIME_SA=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com
gcloud secrets add-iam-policy-binding GEMINI_API_KEY --member="serviceAccount:$RUNTIME_SA" --role="roles/secretmanager.secretAccessor"
```

3) GitHub Actions secrets
- Add the following repository secrets in GitHub Settings → Secrets:
  - `GCP_SA_KEY`: JSON key for `github-deployer` service account (create with `gcloud iam service-accounts keys create key.json --iam-account=github-deployer@$PROJECT_ID.iam.gserviceaccount.com`)
  - `GCP_PROJECT`: your GCP project id
  - `GCP_REGION`: e.g. `us-central1`
  - `CLOUD_RUN_SERVICE`: `bridgemind-backend`
  - `GEMINI_API_KEY`: (optional) you can set this directly or prefer using Secret Manager and not store this in GitHub Secrets

4) Deploy manually (test)

Build image and deploy with `gcloud`:

```bash
# Build and push
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE:latest

# Deploy
gcloud run deploy $SERVICE --image gcr.io/$PROJECT_ID/$SERVICE:latest --region $REGION --platform managed --allow-unauthenticated --set-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest
```

Note: `--set-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest` instructs Cloud Run to mount the secret into the container as an environment variable.

5) Local testing

Build and run locally with Docker:

```bash
docker build -t bridgemind-local .
docker run -p 8080:8080 --env GEMINI_API_KEY="your_key" bridgemind-local

# Verify health
curl http://localhost:8080/health
```

6) Firebase Hosting
- `firebase.json` already has a rewrite mapping `/api/**` to the Cloud Run service named `bridgemind-backend` in `us-central1`. If you used a different service name or region, update [firebase.json](firebase.json).

7) GitHub Actions
- Push to `main` to trigger the workflow `.github/workflows/deploy.yml`. The workflow builds and deploys the image using the GCP service account key in `GCP_SA_KEY`.

8) Post-deploy checks
- Visit the Cloud Run URL and ensure `/health` returns `200`.
- Confirm `/api/greeting` responds (should not 404).
- Check Cloud Logging for any errors and adjust memory/timeout concurrently.

If you want, I can create the service account key file for you locally (requires your GCP auth) or commit a small helper script to automate these steps.
