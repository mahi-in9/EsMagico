import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api/api";

export const createTask = createAsyncThunk(
  "task/create",
  async ({ projectId, taskData }, thunkApi) => {
    try {
      const res = await api.post(`/api/project/${projectId}/task`, taskData);
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const getTasks = createAsyncThunk(
  "task/getAll",
  async (projectId, thunkApi) => {
    try {
      const res = await api.get(`/api/project/${projectId}/task`);
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const updateTask = createAsyncThunk(
  "task/update",
  async ({ projectId, taskId, taskData }, thunkApi) => {
    try {
      const res = await api.put(
        `/api/project/${projectId}/task/${taskId}`,
        taskData,
      );
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const updateTaskStatus = createAsyncThunk(
  "task/updateStatus",
  async ({ projectId, taskId, status }, thunkApi) => {
    try {
      const res = await api.patch(
        `/api/project/${projectId}/task/${taskId}/status`,
        { status },
      );
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const retryTask = createAsyncThunk(
  "task/retry",
  async ({ projectId, taskId }, thunkApi) => {
    try {
      const res = await api.post(
        `/api/project/${projectId}/task/${taskId}/retry`,
      );
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const deleteTask = createAsyncThunk(
  "task/delete",
  async ({ projectId, taskId }, thunkApi) => {
    try {
      await api.delete(`/api/project/${projectId}/task/${taskId}`);
      return taskId;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const getTaskHistory = createAsyncThunk(
  "task/history",
  async ({ projectId, taskId }, thunkApi) => {
    try {
      const res = await api.get(
        `/api/project/${projectId}/task/${taskId}/history`,
      );
      return { taskId, history: res.data.data };
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

const upsertTask = (state, task) => {
  const idx = state.tasks.findIndex((t) => t._id === task._id);
  if (idx !== -1) state.tasks[idx] = task;
  else state.tasks.push(task);
};

const taskSlice = createSlice({
  name: "task",
  initialState: {
    tasks: [],
    taskHistory: [],
    loading: false,
    error: null,
    conflictError: null,
  },
  reducers: {
    clearConflictError: (state) => {
      state.conflictError = null;
    },
    clearTaskError: (state) => {
      state.error = null;
    },
    // Socket-driven reducers
    socketTaskCreated: (state, a) => {
      upsertTask(state, a.payload);
    },
    socketTaskUpdated: (state, a) => {
      upsertTask(state, a.payload);
    },
    socketTaskStatusChanged: (state, a) => {
      const { taskId, status, task } = a.payload;
      const idx = state.tasks.findIndex(
        (t) => t._id === taskId || t._id === taskId?.toString(),
      );
      if (idx !== -1) {
        if (task) state.tasks[idx] = task;
        else state.tasks[idx].status = status;
      }
    },
    socketTaskDeleted: (state, a) => {
      state.tasks = state.tasks.filter(
        (t) =>
          t._id !== a.payload.taskId && t._id !== a.payload.taskId?.toString(),
      );
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTask.fulfilled, (state, a) => {
        state.loading = false;
        if (a.payload) state.tasks.push(a.payload);
      })
      .addCase(createTask.rejected, (state, a) => {
        state.loading = false;
        state.error = a.payload;
      })
      .addCase(getTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTasks.fulfilled, (state, a) => {
        state.loading = false;
        state.tasks = a.payload || [];
      })
      .addCase(getTasks.rejected, (state, a) => {
        state.loading = false;
        state.error = a.payload;
      })
      .addCase(updateTask.pending, (state) => {
        state.loading = true;
        state.conflictError = null;
      })
      .addCase(updateTask.fulfilled, (state, a) => {
        state.loading = false;
        if (a.payload) upsertTask(state, a.payload);
      })
      .addCase(updateTask.rejected, (state, a) => {
        state.loading = false;
        if (a.payload?.message?.toLowerCase().includes("conflict"))
          state.conflictError = a.payload;
        else state.error = a.payload;
      })
      .addCase(updateTaskStatus.fulfilled, (state, a) => {
        if (a.payload) upsertTask(state, a.payload);
      })
      .addCase(updateTaskStatus.rejected, (state, a) => {
        state.error = a.payload;
      })
      .addCase(retryTask.fulfilled, (state, a) => {
        if (a.payload) upsertTask(state, a.payload);
      })
      .addCase(retryTask.rejected, (state, a) => {
        state.error = a.payload;
      })
      .addCase(deleteTask.fulfilled, (state, a) => {
        state.tasks = state.tasks.filter((t) => t._id !== a.payload);
      })
      .addCase(deleteTask.rejected, (state, a) => {
        state.error = a.payload;
      })
      .addCase(getTaskHistory.fulfilled, (state, a) => {
        state.taskHistory = a.payload?.history || [];
      });
  },
});

export const {
  clearConflictError,
  clearTaskError,
  socketTaskCreated,
  socketTaskUpdated,
  socketTaskStatusChanged,
  socketTaskDeleted,
} = taskSlice.actions;
export default taskSlice.reducer;
