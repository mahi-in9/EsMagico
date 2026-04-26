import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../api/api";

export const createProject = createAsyncThunk(
  "project/create",
  async (data, thunkApi) => {
    try {
      const res = await api.post("/api/project", data);
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const getProjects = createAsyncThunk(
  "project/getAll",
  async (_, thunkApi) => {
    try {
      const res = await api.get("/api/project");
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const getProjectById = createAsyncThunk(
  "project/getById",
  async (id, thunkApi) => {
    try {
      const res = await api.get(`/api/project/${id}`);
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const generateInvite = createAsyncThunk(
  "project/generateInvite",
  async (id, thunkApi) => {
    try {
      const res = await api.post(`/api/project/${id}/invite`);
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const joinProject = createAsyncThunk(
  "project/join",
  async (token, thunkApi) => {
    try {
      const res = await api.post(`/api/project/join/${token}`);
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const computeExecution = createAsyncThunk(
  "project/computeExecution",
  async (id, thunkApi) => {
    try {
      const res = await api.post(`/api/project/${id}/compute-execution`);
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const runSimulation = createAsyncThunk(
  "project/simulate",
  async ({ id, body }, thunkApi) => {
    try {
      const res = await api.post(`/api/project/${id}/simulate`, body);
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const getAuditLogs = createAsyncThunk(
  "project/auditLogs",
  async (id, thunkApi) => {
    try {
      const res = await api.get(`/api/project/${id}/audit-logs`);
      return res.data.data;
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

export const updateWebhook = createAsyncThunk(
  "project/updateWebhook",
  async ({ id, webhookUrl }, thunkApi) => {
    try {
      const res = await api.put(`/api/project/${id}/webhook`, { webhookUrl });
      return { id, webhookUrl };
    } catch (e) {
      return thunkApi.rejectWithValue(e?.response?.data);
    }
  },
);

const projectSlice = createSlice({
  name: "project",
  initialState: {
    projects: [],
    currentProject: null,
    inviteToken: null,
    executionPlan: null,
    simulationResult: null,
    auditLogs: [],
    projectLoading: false,
    actionLoading: false,
    projectError: null,
  },
  reducers: {
    clearInviteToken: (state) => {
      state.inviteToken = null;
    },
    clearExecutionPlan: (state) => {
      state.executionPlan = null;
    },
    clearSimulation: (state) => {
      state.simulationResult = null;
    },
    clearProjectError: (state) => {
      state.projectError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createProject.fulfilled, (state, a) => {
        state.projects.push(a.payload);
      })
      .addCase(getProjects.pending, (state) => {
        state.projectLoading = true;
        state.projectError = null;
      })
      .addCase(getProjects.fulfilled, (state, a) => {
        state.projectLoading = false;
        state.projects = a.payload || [];
      })
      .addCase(getProjects.rejected, (state, a) => {
        state.projectLoading = false;
        state.projectError = a.payload;
      })
      .addCase(getProjectById.pending, (state) => {
        state.projectLoading = true;
      })
      .addCase(getProjectById.fulfilled, (state, a) => {
        state.projectLoading = false;
        state.currentProject = a.payload;
      })
      .addCase(getProjectById.rejected, (state, a) => {
        state.projectLoading = false;
        state.projectError = a.payload;
      })
      .addCase(generateInvite.fulfilled, (state, a) => {
        state.inviteToken = a.payload?.inviteToken;
      })
      .addCase(joinProject.fulfilled, (state, a) => {
        if (a.payload) state.projects.push(a.payload);
      })
      .addCase(computeExecution.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(computeExecution.fulfilled, (state, a) => {
        state.actionLoading = false;
        state.executionPlan = a.payload;
      })
      .addCase(computeExecution.rejected, (state, a) => {
        state.actionLoading = false;
        state.projectError = a.payload;
      })
      .addCase(runSimulation.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(runSimulation.fulfilled, (state, a) => {
        state.actionLoading = false;
        state.simulationResult = a.payload;
      })
      .addCase(runSimulation.rejected, (state, a) => {
        state.actionLoading = false;
        state.projectError = a.payload;
      })
      .addCase(getAuditLogs.fulfilled, (state, a) => {
        state.auditLogs = a.payload || [];
      })
      .addCase(updateWebhook.fulfilled, (state, a) => {
        if (state.currentProject?._id === a.payload.id)
          state.currentProject.webhookUrl = a.payload.webhookUrl;
      });
  },
});

export const {
  clearInviteToken,
  clearExecutionPlan,
  clearSimulation,
  clearProjectError,
} = projectSlice.actions;
export default projectSlice.reducer;
