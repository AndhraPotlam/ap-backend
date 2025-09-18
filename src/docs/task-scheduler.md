# Task Scheduler System Documentation (Vercel Serverless)

## Overview

The Task Scheduler System automatically generates individual task entries for each day, week, or month based on task templates using **Vercel Cron Jobs**. This ensures proper tracking, completion status, and calendar visualization for recurring tasks in a serverless environment.

## Key Features

### ✅ Individual Daily Task Entries
- **YES**: When a task is set to daily, you get individual task entries for each day
- Each day has separate task instances with unique IDs
- Individual completion status tracking per day
- Separate time tracking and notes per day

### ✅ Automatic Scheduling (Vercel Cron Jobs)
- **Daily Tasks**: Generated at 12:00 AM every day via Vercel cron
- **Weekly Tasks**: Generated at 12:00 AM every Sunday via Vercel cron
- **Monthly Tasks**: Generated at 12:00 AM on the 1st of each month via Vercel cron

### ✅ Manual Generation
- Generate tasks for specific dates
- Generate tasks for date ranges
- Bulk task creation for planning

## Architecture

### 1. Vercel Cron Configuration (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-daily-tasks",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/generate-weekly-tasks", 
      "schedule": "0 0 * * 0"
    },
    {
      "path": "/api/cron/generate-monthly-tasks",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

### 2. TaskScheduler Service (`/services/taskScheduler.ts`)

```typescript
export class TaskScheduler {
  // Singleton pattern for global access
  private static instance: TaskScheduler;
  
  // Public methods for Vercel cron endpoints
  public async generateDailyTasks(): Promise<void>
  public async generateWeeklyTasks(): Promise<void>
  public async generateMonthlyTasks(): Promise<void>
}
```

### 3. Cron API Routes (`/routes/cronRoutes.ts`)

```typescript
// Vercel cron endpoints (no auth required)
router.post('/generate-daily-tasks', async (req, res) => {
  await taskScheduler.generateDailyTasks();
});

router.post('/generate-weekly-tasks', async (req, res) => {
  await taskScheduler.generateWeeklyTasks();
});

router.post('/generate-monthly-tasks', async (req, res) => {
  await taskScheduler.generateMonthlyTasks();
});
```

### 4. Task Controller Extensions (`/controllers/taskController.ts`)

```typescript
export const taskController = {
  // ... existing methods ...
  
  // New scheduler methods
  generateTasksForDateRange,
  generateTasksForDate,
  getSchedulerStatus,
  startScheduler,
  stopScheduler,
  
  // Manual trigger methods (for testing)
  triggerDailyTasks,
  triggerWeeklyTasks,
  triggerMonthlyTasks
};
```

### 5. New API Routes (`/routes/taskRoutes.ts`)

```typescript
// Task scheduler routes
router.post('/generate-date-range', taskController.generateTasksForDateRange);
router.post('/generate-date', taskController.generateTasksForDate);
router.get('/scheduler/status', taskController.getSchedulerStatus);
router.post('/scheduler/start', taskController.startScheduler);
router.post('/scheduler/stop', taskController.stopScheduler);

// Manual trigger routes (for testing/debugging)
router.post('/trigger/daily', taskController.triggerDailyTasks);
router.post('/trigger/weekly', taskController.triggerWeeklyTasks);
router.post('/trigger/monthly', taskController.triggerMonthlyTasks);
```

## How It Works

### Daily Task Generation Process (Vercel Cron)

1. **12:00 AM Daily**: Vercel cron triggers `/api/cron/generate-daily-tasks`
2. **API Endpoint**: Cron route calls `taskScheduler.generateDailyTasks()`
3. **Check Existing**: Verifies if daily tasks for today already exist
4. **Get Templates**: Fetches all active daily task templates
5. **Get Users**: Fetches all active users
6. **Create Tasks**: Creates individual task entries for each template-user combination
7. **Set Due Date**: Each task is due at end of day (11:59 PM)

### Individual Task Entries Example

```json
// Day 1 - January 15, 2024
{
  "taskId": "task_2024_01_15_001",
  "title": "Clean Kitchen",
  "checklistType": "daily",
  "dueDate": "2024-01-15T23:59:59.999Z",
  "status": "completed",
  "createdAt": "2024-01-15T00:00:00.000Z",
  "completedAt": "2024-01-15T10:30:00.000Z"
}

// Day 2 - January 16, 2024
{
  "taskId": "task_2024_01_16_001",
  "title": "Clean Kitchen", 
  "checklistType": "daily",
  "dueDate": "2024-01-16T23:59:59.999Z",
  "status": "pending",
  "createdAt": "2024-01-16T00:00:00.000Z"
}
```

## API Endpoints

### 1. Generate Tasks for Date Range
```http
POST /api/tasks/generate-date-range
Content-Type: application/json

{
  "startDate": "2024-01-15",
  "endDate": "2024-01-21",
  "checklistType": "daily"
}
```

**Response:**
```json
{
  "message": "Generated 42 daily tasks for date range",
  "tasksCreated": 42
}
```

### 2. Generate Tasks for Single Date
```http
POST /api/tasks/generate-date
Content-Type: application/json

{
  "date": "2024-01-15",
  "checklistType": "daily"
}
```

### 3. Get Scheduler Status
```http
GET /api/tasks/scheduler/status
```

**Response:**
```json
{
  "isRunning": true,
  "message": "Task scheduler is running"
}
```

### 4. Start/Stop Scheduler
```http
POST /api/tasks/scheduler/start
POST /api/tasks/scheduler/stop
```

## Frontend Integration

### TaskGenerator Component

The frontend includes a `TaskGenerator` component with:

- **Scheduler Status**: Shows if scheduler is running/stopped
- **Manual Generation**: Form to generate tasks for specific dates
- **Date Range Generation**: Generate tasks for multiple days
- **Scheduler Controls**: Start/stop scheduler buttons

### Calendar View Updates

The calendar view now properly displays:
- Individual daily tasks (not duplicates)
- Different completion status per day
- Proper task distribution across dates
- Accurate workload visualization

## Benefits

### ✅ Individual Tracking
- Each day has separate task entries
- Track completion status per day
- Individual time tracking per day
- Separate notes and attachments per day

### ✅ Calendar Visualization
- Calendar shows actual daily tasks
- Different completion status per day
- Proper task distribution across dates
- Accurate workload visualization

### ✅ Analytics & Reporting
- Daily completion rates
- Task performance over time
- User productivity metrics
- Historical task data

### ✅ Flexibility
- Manual task generation for specific dates
- Bulk task creation for date ranges
- Custom assignment rules
- Role-based task assignment

## Installation & Setup (Vercel)

### 1. Vercel Configuration
The `vercel.json` file is already configured with cron jobs:

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-daily-tasks",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/generate-weekly-tasks", 
      "schedule": "0 0 * * 0"
    },
    {
      "path": "/api/cron/generate-monthly-tasks",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

### 2. Deploy to Vercel
```bash
# Deploy to Vercel
vercel --prod

# Or push to your connected Git repository
git push origin main
```

### 3. Environment Variables
No additional environment variables required. The scheduler uses the existing MongoDB connection.

### 4. Vercel Cron Jobs
- Cron jobs are automatically enabled when you deploy to Vercel
- They run in Vercel's serverless environment
- No need for persistent background processes

## Usage Examples

### Generate Daily Tasks for Next Week
```javascript
const response = await fetch('/api/tasks/generate-date-range', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startDate: '2024-01-15',
    endDate: '2024-01-21',
    checklistType: 'daily'
  })
});
```

### Check Scheduler Status
```javascript
const response = await fetch('/api/tasks/scheduler/status');
const status = await response.json();
console.log(status.isRunning); // true/false
```

### Manual Trigger (for testing)
```javascript
// Trigger daily tasks manually
const response = await fetch('/api/tasks/trigger/daily', {
  method: 'POST'
});
```

## Troubleshooting

### Common Issues

1. **Tasks Not Generating**
   - Check Vercel cron job logs in Vercel dashboard
   - Verify task templates exist and are active
   - Check if users exist and are active
   - Test manual triggers: `POST /api/tasks/trigger/daily`

2. **Duplicate Tasks**
   - The system prevents duplicate generation for the same date
   - Check existing tasks before generating new ones

3. **Vercel Cron Jobs Not Running**
   - Check Vercel dashboard for cron job status
   - Verify `vercel.json` configuration is correct
   - Check Vercel function logs for errors
   - Ensure deployment is successful

### Logs

The scheduler provides detailed logging in Vercel function logs:
```
Vercel cron: Generating daily tasks...
Generated 15 daily tasks for Mon Jan 15 2024
Daily tasks generated successfully
```

## Future Enhancements

1. **Smart Assignment**: Role-based task assignment
2. **Workload Balancing**: Distribute tasks based on user capacity
3. **Custom Schedules**: More flexible recurring patterns
4. **Notifications**: Email/SMS notifications for task assignments
5. **Analytics Dashboard**: Advanced reporting and insights

## Conclusion

The Task Scheduler System ensures that **YES, when a task is set to daily, you will have individual task entries for each day**. This provides proper tracking, completion status, and calendar visualization for all recurring tasks.

The system is fully automated via **Vercel Cron Jobs** but also provides manual controls for flexibility and planning. Each day gets separate task instances, allowing individual tracking and management of recurring tasks in a serverless environment.

**Key Benefits for Vercel Deployment:**
- ✅ No persistent background processes required
- ✅ Automatic scaling with Vercel's serverless functions
- ✅ Reliable cron job execution via Vercel's infrastructure
- ✅ Cost-effective (only runs when needed)
- ✅ Easy monitoring via Vercel dashboard
