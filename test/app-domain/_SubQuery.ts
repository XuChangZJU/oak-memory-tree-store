import * as Application from "./Application/Schema";
import * as ExtraFile from "./ExtraFile/Schema";
import * as Mobile from "./Mobile/Schema";
import * as UserSystem from "./UserSystem/Schema";
import * as System from "./System/Schema";
import * as Token from "./Token/Schema";
import * as User from "./User/Schema";
import * as WechatUser from "./WechatUser/Schema";
export type ApplicationIdSubQuery = {
    [K in "$in" | "$nin"]?: (WechatUser.ApplicationIdSubQuery & {
        entity: "wechatUser";
    }) | (Application.ApplicationIdSubQuery & {
        entity: "application";
    });
};
export type ExtraFileIdSubQuery = {
    [K in "$in" | "$nin"]?: (ExtraFile.ExtraFileIdSubQuery & {
        entity: "extraFile";
    });
};
export type MobileIdSubQuery = {
    [K in "$in" | "$nin"]?: (Mobile.MobileIdSubQuery & {
        entity: "mobile";
    });
};
export type UserSystemIdSubQuery = {
    [K in "$in" | "$nin"]?: (UserSystem.UserSystemIdSubQuery & {
        entity: "userSystem";
    });
};
export type SystemIdSubQuery = {
    [K in "$in" | "$nin"]?: (Application.SystemIdSubQuery & {
        entity: "application";
    }) | (UserSystem.SystemIdSubQuery & {
        entity: "userSystem";
    }) | (System.SystemIdSubQuery & {
        entity: "system";
    });
};
export type TokenIdSubQuery = {
    [K in "$in" | "$nin"]?: (Token.TokenIdSubQuery & {
        entity: "token";
    });
};
export type UserIdSubQuery = {
    [K in "$in" | "$nin"]?: (Mobile.UserIdSubQuery & {
        entity: "mobile";
    }) | (UserSystem.UserIdSubQuery & {
        entity: "userSystem";
    }) | (Token.UserIdSubQuery & {
        entity: "token";
    }) | (User.UserIdSubQuery & {
        entity: "user";
    }) | (WechatUser.UserIdSubQuery & {
        entity: "wechatUser";
    }) | (User.UserIdSubQuery & {
        entity: "user";
    });
};
export type WechatUserIdSubQuery = {
    [K in "$in" | "$nin"]?: (WechatUser.WechatUserIdSubQuery & {
        entity: "wechatUser";
    });
};
