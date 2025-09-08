import {
  heightPercentageToDP as hp,
  widthPercentageToDP as wp,
} from 'react-native-responsive-screen';

export interface IFonts {
  montserrat: any;
  goodTimes: string;
  montserratSemibold: string;
  montserratRegular: string;
  MontserratBold: string;
  PopinsRegular: string;
  PopinsBold: string;
}

export const fonts: IFonts = {
  goodTimes: 'GoodTimesRg-Regular',
  montserratSemibold: 'Montserrat-SemiBold',
  montserratRegular: 'Montserrat-Regular',
  MontserratBold: 'Montserrat-Bold',
  PopinsRegular: 'Popins-Regular',
  PopinsBold: 'PopinsBold',
};

export const FontSize = {
  h1: hp(1),
  h1_1: hp(1.1),
  h1_2: hp(1.2),
  h1_3: hp(1.3),
  h1_4: hp(1.4),
  h1_5: hp(1.5),
  h1_6: hp(1.6),
  h1_7: hp(1.7),
  h1_8: hp(1.8),
  h1_9: hp(1.9),
  h2: hp(2),
  h2_1: hp(2.1),
  h2_3: hp(2.3),
  h2_5: hp(2.5),
  h2_6: hp(2.6),
  h2_7: hp(2.7),
  h2_8: hp(2.8),
  h3: hp(3),
  h3_1: hp(3.1),
  h3_2: hp(3.2),
  h3_3: hp(3.3),
  h3_4: hp(3.4),
  h3_5: hp(3.5),
  h3_6: hp(3.6),
  h3_7: hp(3.7),
  h4: hp(4),
  h4_5: hp(4.5),
  h5: hp(5),
  h5_5: hp(5.5),
  h6: hp(6),
};
