import { world, system, CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus } from "@minecraft/server";
import { beforeEvents, kickPlayer } from "@minecraft/server-admin";

const banPlayerList = [];//预设

//玩家加入
system.run(async() => {
    beforeEvents.asyncPlayerJoin.subscribe(player => {
        tipPlayerOP(`玩家 ${player.name} 连接服务器`);
        
        //是否为黑名单玩家
        if (JSON.parse(world.getDynamicProperty("ban_list")??"[]").includes(player.name)) {
            tipPlayerOP(`玩家 ${player.name} 为黑名单玩家，已阻止加入`);
            player.disallowJoin(reasonForDisconnect(player, "You cannot connect to this server"));
            return;
        }
        
        //检测name或pid是否为空
        if (player.persistentId.replaceAll(" ", "")==""||player.name.replaceAll(" ", "")=="") {
            tipPlayerOP(`玩家 ${player.name} 为空ID或空PID`);
            player.disallowJoin(reasonForDisconnect(player, "The NAME or PID does not exist"));
            return;
        }
        
        //允许加入
        player.allowJoin();
        return;
    });
});

//断开连接原因
function reasonForDisconnect(player, reason) {
    return `[NAME] ${player.name}\n[PID] ${player.persistentId}\n[TIME] ${getTime()}\n[REASON] ${reason}\n\n☆ Behavior Pack for Server | Made by ANQIN2 ☆`
}
//信息发送
function tipPlayerOP(msg) {
    system.run(() => {
        for (const player of world.getPlayers({tags:["服主"]})) {
            player.sendMessage(`§l§b[系统]§r ${msg}`);
        }
    });
}
//时间
function getTime() {
    const nowtime = new Date();
    return `${nowtime.getFullYear()}-${nowtime.getMonth()+1}-${nowtime.getDate()} ${nowtime.getHours()}:${nowtime.getMinutes()}:${nowtime.getSeconds()}`;
}

//将预设玩家添加至黑名单/更新
system.run(() => {
    const add_banList = [];
    const banList = JSON.parse(world.getDynamicProperty("ban_list")??"[]");
    
    for (const name of banPlayerList) {
        if (!banList.includes(name)) {
            add_banList.push(name);
            banList.push(name);
        }
    }
    
    if (add_banList.length>0) {
        world.setDynamicProperty("ban_list", JSON.stringify(banList));
        console.warn(`[server] 已将 ${add_banList.length} 名预设玩家添加至黑名单`);
    }
});

//注册命令
system.beforeEvents.startup.subscribe(({customCommandRegistry:cmd}) => {
    cmd.registerCommand(
        {
            name: "p:ban",
            description: "Ban an online player",
            permissionLevel: CommandPermissionLevel.GameDirectors,
            cheatsRequired: false,
            mandatoryParameters: [
                { name: "Target", type: CustomCommandParamType.PlayerSelector }
            ]
        },
        (origin, targets) => {
            const player = origin.initiator ?? origin.sourceEntity;
            if (!player||player.typeId!=="minecraft:player") {
                return { message: "执行者必须为有效玩家实体", status: CustomCommandStatus.Failure };
            };
            
            if (!targets||targets.length==0) {
                player.sendMessage(`§c§l[系统]§r 输入的玩家无效`);
                return;
            } else if (targets.length>1) {
                player.sendMessage(`§c§l[系统]§r 不能同时封禁多名玩家`);
                return;
            }
            
            const target = targets[0];
            if (target.commandPermissionLevel>=3) {
                player.sendMessage(`§c§l[系统]§r 无法封禁服务器主持者`);
                return;
            }
            
            system.run(() => {
                try {
                    //注意: 这里只针对在线玩家，如果该在线玩家被封禁了，他无法加入房间，所以不需要做防重
                    const banList = JSON.parse(world.getDynamicProperty("ban_list")??"[]");
                    banList.push(target.name);
                    world.setDynamicProperty("ban_list", JSON.stringify(banList));
                    world.sendMessage(`§a§l[系统]§r 玩家 §b${target.name}§r 被服务器封禁`);
                    kickPlayer(target, reasonForDisconnect(target,"You have been banned by the server"));
                } catch(e) {
                    player.sendMessage(`§c§l[系统]§r 封禁名称为 §b${target.name}§r 的玩家失败，原因: ${e}`)
                }
            });
        }
    )
    
    cmd.registerEnum("p:bans", ["add","remove","search"]);
    cmd.registerCommand(
        {
            name: "p:bans",
            description: "Ban or unban offline players, or search for banned players",
            permissionLevel: CommandPermissionLevel.GameDirectors,
            cheatsRequired: false,
            mandatoryParameters: [
                { name: "Operation", type: CustomCommandParamType.Enum, enumName: "p:bans" },
                { name: "Target", type: CustomCommandParamType.String }
            ],
        },
        (origin, operationParam, targetParam) => {
            const player = origin.initiator ?? origin.sourceEntity;
            if (!player||player.typeId!=="minecraft:player") {
                return { message: "执行者必须为有效玩家实体", status: CustomCommandStatus.Failure };
            };
            
            const target = targetParam.trim() ?? null;
            if (!target||target.length==0) {
                player.sendMessage("§c§l[系统]§r 请输入有效名称");
                return;
            }
            
            const operation = operationParam.trim();
            const banList = JSON.parse(world.getDynamicProperty("ban_list")??"[]");
            system.run(() => {
                switch (operation.toLowerCase()) {
                    case "add":
                        try {
                            //这里检查是否有在线玩家，如果有执行踢出
                            world.getPlayers({name: target}).forEach(p=>kickPlayer(p,reasonForDisconnect(p,"You have been banned by the server")));
                            
                            if (banList.includes(target)) {
                                player.sendMessage(`§c§l[系统]§r 封禁名单已有名称为 §b${target}§r 的玩家`);
                                return;
                            }
                            banList.push(target);
                            world.setDynamicProperty("ban_list", JSON.stringify(banList));
                            player.sendMessage(`§a§l[系统]§r 已封禁名称为 §b${target}§r 的玩家`);
                        } catch(e) {
                            player.sendMessage(`§c§l[系统]§r 封禁名称为 §b${target}§r 的玩家失败，原因: ${e}`);
                        }
                        break;
                    case "remove":
                        try {
                            if (!banList.includes(target)) {
                                player.sendMessage(`§c§l[系统]§r 封禁名单没有名称为 §b${target}§r 的玩家`);
                                return;
                            }
                            world.setDynamicProperty("ban_list", JSON.stringify(banList.filter(p=>p!==target)));
                            player.sendMessage(`§a§l[系统]§r 已解封名称为 §b${target}§r 的玩家`);
                        } catch(e) {
                            player.sendMessage(`§c§l[系统]§r 解封名称为 §b${target}§r 的玩家失败，原因: ${e}`);
                        }
                        break;
                    case "search":
                        try {
                            if (banList.includes(target)) {
                                player.sendMessage(`§a§l[系统]§r 封禁名单存在名称为 §b${target}§r 的玩家`);
                                return;
                            } else {
                                player.sendMessage(`§c§l[系统]§r 封禁名单没有名称为 §b${target}§r 的玩家`);
                            }
                        } catch(e) {
                            player.sendMessage(`§c§l[系统]§r 搜索名称为 §b${target}§r 的玩家失败，原因: ${e}`);
                        }
                        break;
                    default:
                        player.sendMessage(`§l§c[系统]§r 无效的操作: ${operation}`);
                        return;
                }
            });
        }
    );
    
    cmd.registerCommand(
        {
            name: "p:banlist",
            description: "Send information on the number of players who have been banned to the world",
            permissionLevel: CommandPermissionLevel.GameDirectors,
            cheatsRequired: false
        },
        (origin) => {
            const source = origin.initiator ?? origin.sourceEntity;
            if (source) {
                system.run(() => {
                    const banList = JSON.parse(world.getDynamicProperty("ban_list")??"[]");
                    world.sendMessage(`§b§l[系统]§r 当前已封禁 ${banList.length??0} 名玩家`);
                    console.warn(`[server] 所有封禁玩家名称: ${banList.join(", ")}`);
                });
            }
        }
    )
});
