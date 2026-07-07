declare namespace Express {
  export interface Request {
    user: {
      id: string;
      email: string;
      role: string;
      // add other fields as needed
    };
  }
}
