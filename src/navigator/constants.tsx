export enum Routes {
  Login = 'Login',
  PrivacyPolicy = 'PrivacyPolicy',
  ForgetPassword = 'ForgetPassword',
  OtpVerification = 'OtpVerification',
  SignUp = 'SignUp',
  Home = 'Home',
  About = 'About',
  Tab = 'Tab',
  Notification = 'Notification',
  Transaction = 'Transaction',
  TabTransaction = 'TabTransaction',
  BalanceHistory = 'BalanceHistory',
  ReceivePayment = 'ReceivePayment',
  TransactionHistory = 'TransactionHistory',
  AddAccount = 'AddAccount',
  VerifyEmail = 'VerifyEmail',
  QRScanner = 'QRScanner',
  Paynow = 'Paynow',
  Profile = 'Profile',
  BankList = 'BankList',
  GroupSettings = 'GroupSettings',
}

// Extra bottom padding the in-group tab screens need so their last row can
// scroll clear of the floating "Add expense" pill and the AI orb stacked
// above it (see BottomTabNavigator.tsx: pill at tabBar+46, 54 tall; orb
// 14 above it, 46 tall; plus breathing room).
export const FLOATING_ACTIONS_CLEARANCE = 46 + 54 + 14 + 46 + 16;
