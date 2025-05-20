// types.ts
export type RootStackParamList = {
  LoginWithVerification: undefined;
  SignupWithVerification: undefined;
  About: undefined;
  Home: undefined;
  Login: undefined;
  AddAccount: undefined;
  VerifyEmail: undefined;
  QRScanner: undefined;
  Paynow: undefined;
  Profile: undefined;
  Banklist: undefined;
  SignUp: {
    credentials?: string | never;
  };
  TransactionHistory: undefined;
  ReceivePayment: undefined;
  Transaction: undefined;
  TabTransaction: undefined;
  Tab: undefined;
  Notification: undefined;
  OtpVerification: {
    credentials?: any | never;
    verifyCredentials?: (code: string) => void;
  };
};
