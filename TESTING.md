# Andhra Potlam Backend Testing Guide

This document outlines the testing strategy, tools, local environment setup, and CI configurations for the `ap-backend` application.

---

## 1. Testing Strategy

We follow a two-tier testing strategy to ensure code correctness and integration stability:

```
┌───────────────────────────────────────────────┐
│           Playwright API Integration          │   <-- Tests routes, controller logic, DB
└───────────────────────┬───────────────────────┘
                        │
┌───────────────────────▼───────────────────────┐
│               Jest Unit Tests                 │   <-- Tests schemas, hooks, helper functions
└───────────────────────────────────────────────┘
```

1. **Unit Tests (Jest)**: Fast, offline, isolated tests that mock external dependencies (like databases or third-party APIs). They are ideal for validating schema properties, Mongoose hooks, and helper/business logic functions.
2. **Integration Tests (Playwright API Client)**: Tests executed against a running API server connected to an isolated test MongoDB database. They validate request/response validation, authentication headers, database insertions, and middleware behaviour.

---

## 2. Tools & Stack

- **Jest**: Core test runner for unit tests.
- **ts-jest**: TypeScript preprocessor for Jest.
- **Playwright Test**: Framework for executing HTTP/API integration tests.
- **Docker Compose**: Orchestrates isolated testing environments (MongoDB + API container).
- **Mongoose / ts-node**: Used to connect and seed baseline database states through type-safe schema models.

---

## 3. Directory Structure

```
ap-backend/
├── .github/workflows/
│   └── test.yml                 # CI Actions workflow configuration
├── tests/
│   ├── unit/
│   │   └── user.test.ts         # Jest unit test for User model
│   ├── integration/
│   │   └── auth.spec.ts         # Playwright API integration tests
│   └── setup/
│       └── seed.ts              # Mongoose-based database seed script
├── docker-compose.test.yml      # Isolated test stack definition (Mongo + API)
├── jest.config.js               # Jest configuration
└── playwright.config.ts         # Playwright API client configuration
```

---

## 4. Local Setup & Execution

### Prerequisites
- Node.js (v20+)
- Docker and Docker Compose (if running full integration suites locally)

### Step 1: Install Dependencies
Ensure all development and test dependencies are installed:
```bash
yarn install
```

### Step 2: Running Unit Tests
Unit tests run instantly and do not require a database connection.
```bash
yarn test:unit
```

### Step 3: Running Integration Tests Locally

To run the integration tests locally under identical environment conditions to CI:

1. **Spin up the isolated test stack**:
   ```bash
   docker-compose -f docker-compose.test.yml up -d --build
   ```
   This will spin up `mongodb-test` (exposing port `27017`) and `backend-test` (exposing port `8001`).

2. **Wait for the API server to be ready**:
   Check health via curl:
   ```bash
   curl http://localhost:8001/api
   ```

3. **Seed the database**:
   Run the Mongoose-based database seeder to populate baseline settings and admin accounts:
   ```bash
   NODE_ENV=test MONGODB_URI=mongodb://localhost:27017/andhra-potlam npx ts-node tests/setup/seed.ts
   ```

4. **Run Playwright Integration Tests**:
   ```bash
   TEST_API_URL=http://localhost:8001/api/ yarn test:integration
   ```

5. **Clean up/Tear down**:
   Always clean up containers and volumes after testing:
   ```bash
   docker-compose -f docker-compose.test.yml down -v
   ```

### Overriding Ports on the Fly
If default ports (`8001` or `27017`) are already allocated on your machine, you can change them seamlessly:
```bash
# Start test compose on custom host ports
TEST_BACKEND_PORT=8002 TEST_MONGO_PORT=27018 docker-compose -f docker-compose.test.yml up -d --build

# Run seed script against custom MongoDB port
NODE_ENV=test MONGODB_URI=mongodb://localhost:27018/andhra-potlam npx ts-node tests/setup/seed.ts

# Run integration tests against custom backend port
TEST_API_URL=http://localhost:8002/api/ yarn test:integration

# Clean up
TEST_MONGO_PORT=27018 docker-compose -f docker-compose.test.yml down -v
```

---

## 5. Environment Configuration Details

### Database Seeding (`tests/setup/seed.ts`)
We use a Mongoose-based seed script instead of raw MongoDB scripts to guarantee validation schema rules and hooks are executed:
- Hashes passwords during user creation using Mongoose's `.pre('save')` hooks.
- Populates categories (e.g., Curries, Biryanis) and default configuration settings (e.g., pricing rates).
- Cleanly truncates collections before seeding to prevent conflicts.

### Test Compose Stack (`docker-compose.test.yml`)
- **`mongodb-test`**: Configured with a `mongosh` healthcheck command that tests ping status before starting dependant backend services.
- **`backend-test`**: Sets `NODE_ENV=test` which tells the backend in `src/server.ts` to bypass SSL/TLS rules (since Atlas SSL is not supported/configured on local vanilla Mongo containers).

---

## 6. GitHub Actions CI Pipeline

The backend CI workflow `.github/workflows/test.yml` operates sequentially on push and pull requests:
1. **Checkout & Node setup**: Checks out code and prepares Node environment.
2. **Jest Suite**: Runs unit tests first. If they fail, the pipeline fails instantly without wasting container resources.
3. **Compose Spin-up**: Launches the test containers.
4. **Health Wait**: Uses `npx wait-on` to wait for the API endpoint on port `8001`.
5. **Database Seeding**: Runs `tests/setup/seed.ts` against the exposed database port.
6. **API Tests**: Runs Playwright tests.
7. **Upload Playwright Report**: Retains and archives any generated test reports as action artifacts for 30 days.
8. **Clean up**: Uses `if: always()` to ensure `docker-compose down -v` is run even if tests fail, freeing up GitHub Actions runner space.
