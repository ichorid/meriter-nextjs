// Mock axios for all tests
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

const axios = jest.fn(() => mockAxiosInstance);
axios.create = jest.fn(() => mockAxiosInstance);
(axios as any).get = mockAxiosInstance.get;
(axios as any).post = mockAxiosInstance.post;
(axios as any).put = mockAxiosInstance.put;
(axios as any).patch = mockAxiosInstance.patch;
(axios as any).delete = mockAxiosInstance.delete;

export default axios;
export { mockAxiosInstance };

