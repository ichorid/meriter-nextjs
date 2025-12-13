// Mock axios for all tests
const mockAxiosInstance: any = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { 
      use: jest.fn((onFulfilled, onRejected) => {
        return 0; 
      })
    },
    response: { 
      use: jest.fn((onFulfilled, onRejected) => {
        return 0;
      })
    },
  },
};

const axios = jest.fn(() => mockAxiosInstance) as any;
axios.create = jest.fn(() => mockAxiosInstance);
(axios as any).get = mockAxiosInstance.get;
(axios as any).post = mockAxiosInstance.post;
(axios as any).put = mockAxiosInstance.put;
(axios as any).patch = mockAxiosInstance.patch;
(axios as any).delete = mockAxiosInstance.delete;

export default axios;
export { mockAxiosInstance };

