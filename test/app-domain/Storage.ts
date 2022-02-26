import { StorageSchema } from "oak-domain/src/types/Storage";
import { desc as applicationDesc } from "./Application/Storage";
import { desc as extraFileDesc } from "./ExtraFile/Storage";
import { desc as mobileDesc } from "./Mobile/Storage";
import { desc as userSystemDesc } from "./UserSystem/Storage";
import { desc as systemDesc } from "./System/Storage";
import { desc as tokenDesc } from "./Token/Storage";
import { desc as userDesc } from "./User/Storage";
import { desc as wechatUserDesc } from "./WechatUser/Storage";
export const storageSchema: StorageSchema = {
    application: applicationDesc,
    extraFile: extraFileDesc,
    mobile: mobileDesc,
    userSystem: userSystemDesc,
    system: systemDesc,
    token: tokenDesc,
    user: userDesc,
    wechatUser: wechatUserDesc
};