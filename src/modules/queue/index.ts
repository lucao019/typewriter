export type TaskStatus = 'waiting' | 'preparing' | 'transcribing' | 'completed' | 'cancelled' | 'failed';

export type QueueTask = {
  id: string;
  filePath: string;
  status: TaskStatus;
  language: string;
  model: string;
  error?: string;
};

export class TaskQueue {
  private tasks: QueueTask[] = [];

  addTask(filePath: string, language: string, model: string): QueueTask {
    const task: QueueTask = {
      id: `task-${Date.now()}-${this.tasks.length}`,
      filePath,
      status: 'waiting',
      language,
      model,
    };

    this.tasks.push(task);
    return task;
  }

  list(): QueueTask[] {
    return [...this.tasks];
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.find((item) => item.id === taskId);
    if (!task) return false;
    task.status = 'cancelled';
    return true;
  }

  updateStatus(taskId: string, status: TaskStatus, error?: string): boolean {
    const task = this.tasks.find((item) => item.id === taskId);
    if (!task) return false;
    task.status = status;
    task.error = error;
    return true;
  }
}
