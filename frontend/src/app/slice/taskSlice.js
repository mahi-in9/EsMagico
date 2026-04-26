import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api/api";

const createTask = createAsyncThunk(
  "task/createTask",
  async ({ projectId, taskData }, thunkApi) => {
    try {
      const res = await api.post(`/api/project/${projectId}/task`, taskData);
      return res.data.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const getTasks = createAsyncThunk(
  "task/getTasks",
  async (projectId, thunkApi) => {
    try {
      const res = await api.get(`/api/project/${projectId}/task`);
      return res.data.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const updateTask = createAsyncThunk(
  "task/updateTask",
  async ({ projectId, taskId, taskData }, thunkApi) => {
    try {
      const res = await api.put(
        `/api/project/${projectId}/task/${taskId}`,
        taskData,
      );
      return res.data.data;
    } catch (error) {
      // 409 = version conflict — pass it through so the UI can handle it
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const updateTaskStatus = createAsyncThunk(
  "task/updateTaskStatus",
  async ({ projectId, taskId, status }, thunkApi) => {
    try {
      const res = await api.patch(
        `/api/project/${projectId}/task/${taskId}/status`,
        { status },
      );
      return res.data.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const retryTask = createAsyncThunk(
  "task/retryTask",
  async ({ projectId, taskId }, thunkApi) => {
    try {
      const res = await api.post(
        `/api/project/${projectId}/task/${taskId}/retry`,
      );
      return res.data.data;
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const deleteTask = createAsyncThunk(
  "task/deleteTask",
  async ({ projectId, taskId }, thunkApi) => {
    try {
      await api.delete(`/api/project/${projectId}/task/${taskId}`);
      return taskId; // return id so we can remove from state
    } catch (error) {
      return thunkApi.rejectWithValue(error?.response?.data);
    }
  },
);

const initialState = {
  tasks: [],
  loading: false,
  error: null,
  conflictError: null, // separate field for 409 version conflicts
};

const taskSlice = createSlice({
  name: "task",
  initialState,
  reducers: {
    clearConflictError(state) {
      state.conflictError = null;
    },
    // Called by WebSocket to add a task from another user
    taskAddedFromSocket(state, action) {
      const exists = state.tasks.find((t) => t._id === action.payload._id);
      if (!exists) state.tasks.push(action.payload);
    },
    // Called by WebSocket when another user updates a task
    taskUpdatedFromSocket(state, action) {
      const index = state.tasks.findIndex((t) => t._id === action.payload._id);
      if (index !== -1) state.tasks[index] = action.payload;
    },
  },
  extraReducers: (builder) => {
    // createTask
    builder
      .addCase(createTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTask.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks.push(action.payload);
      })
      .addCase(createTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // getTasks
    builder
      .addCase(getTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = action.payload;
      })
      .addCase(getTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // updateTask
    builder
      .addCase(updateTask.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.conflictError = null;
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.tasks.findIndex(
          (t) => t._id === action.payload._id,
        );
        if (index !== -1) state.tasks[index] = action.payload;
      })
      .addCase(updateTask.rejected, (state, action) => {
        state.loading = false;
        // Check if it's a 409 conflict
        if (action.payload?.message?.includes("conflict")) {
          state.conflictError = action.payload;
        } else {
          state.error = action.payload;
        }
      });

    // updateTaskStatus
    builder
      .addCase(updateTaskStatus.fulfilled, (state, action) => {
        const index = state.tasks.findIndex(
          (t) => t._id === action.payload._id,
        );
        if (index !== -1) state.tasks[index] = action.payload;
      })
      .addCase(updateTaskStatus.rejected, (state, action) => {
        state.error = action.payload;
      });

    // retryTask
    builder
      .addCase(retryTask.fulfilled, (state, action) => {
        const index = state.tasks.findIndex(
          (t) => t._id === action.payload._id,
        );
        if (index !== -1) state.tasks[index] = action.payload;
      })
      .addCase(retryTask.rejected, (state, action) => {
        state.error = action.payload;
      });

    // deleteTask
    builder
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.tasks = state.tasks.filter((t) => t._id !== action.payload);
      })
      .addCase(deleteTask.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const {
  clearConflictError,
  taskAddedFromSocket,
  taskUpdatedFromSocket,
} = taskSlice.actions;

export {
  createTask,
  getTasks,
  updateTask,
  updateTaskStatus,
  retryTask,
  deleteTask,
};
export default taskSlice.reducer;
