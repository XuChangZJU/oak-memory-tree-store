import { EntityDef as Application } from "./Application/Schema";
import { EntityDef as ExtraFile } from "./ExtraFile/Schema";
import { EntityDef as Mobile } from "./Mobile/Schema";
import { EntityDef as UserSystem } from "./UserSystem/Schema";
import { EntityDef as System } from "./System/Schema";
import { EntityDef as Token } from "./Token/Schema";
import { EntityDef as User } from "./User/Schema";
import { EntityDef as WechatUser } from "./WechatUser/Schema";
type ES = {
    application: Application;
    extraFile: ExtraFile;
    mobile: Mobile;
    userSystem: UserSystem;
    system: System;
    token: Token;
    user: User;
    wechatUser: WechatUser;
};
export default ES;
