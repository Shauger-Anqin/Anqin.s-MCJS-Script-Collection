/*
    查文档 纯打字
    BY ANQIN2
    
    world DynamicProperty
    ping_set0: boolean -- 名字Ping显示开关 默认true
    ping_set1: number -- 名字Ping显示位置 默认1
    ping_set2: boolean -- 聊天显示延迟开关 默认true
    ping_set3: number -- 聊天时Ping的位置 默认0
*/

import { world, system, CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus } from "@minecraft/server";
import { CustomForm, ObservableString, ObservableNumber, ObservableBoolean } from "@minecraft/server-ui";
import { SimulatedPlayer } from "@minecraft/server-gametest";

//玩家加入
world.afterEvents.playerSpawn.subscribe((event) => {
    const { player, initialSpawn } = event;
    if (!initialSpawn) return;
    if (player.playerPermissionLevel>=2) {
        system.runTimeout(()=>{
            player.sendMessage("§a提示:§r 使用指令\n/setting -- 打开设置\n/ping <玩家> -- 查询一个或多个玩家Ping");
        },60);
    }
})

//注册事件 自定义指令
system.beforeEvents.startup.subscribe(({customCommandRegistry:cmd})=>{
    cmd.registerCommand(
        {
            name: "ping:ping",
            description: "查询一个或多个玩家Ping",
            permissionLevel: CommandPermissionLevel.Any,
            optionalParameters: [
                {
                    name: "Player", type: CustomCommandParamType.PlayerSelector
                }
            ]
        },
        (origin, targets)=>{
            const player = origin.sourceEntity;
            if (!player||player.length==0) {
                return {status:CustomCommandStatus.Failure,message: "执行者必须为玩家类型"};
            }
            if (!targets||targets.length==0) {
                return {status:CustomCommandStatus.Failure,message: "目标必须为玩家类型"};
            }
            system.run(()=>{
                for (const target of targets) {
                    if (target instanceof SimulatedPlayer) {
                        player.sendMessage(`${target.name} 延迟为 §cnull`);
                        continue;
                    }
                    const ping = target.getPing();
                    if (ping==null||ping==undefined) {
                        player.sendMessage(`§c玩家为 ${target.name} 无法获取Ping`);
                        continue;
                    }
                    player.sendMessage(`${target.name} 延迟为 ${setColor(ping)}${ping}ms`);
                }
            });
        }
    ),
    
    cmd.registerCommand(
        {
            name: "ping:setting",
            description: "延迟显示设置",
            permissionLevel: CommandPermissionLevel.GameDirectors,
        },
        (origin)=>{
            const player = origin.sourceEntity;
            if (!player||player.length==0) {
                return {status:CustomCommandStatus.Failure,message: "执行者必须为玩家类型"};
            }
            system.run(()=>setting(player));
        }
    )
})

//表单管理
function setting(player) {
    //头顶名称 按钮 禁用 选项
    const nameTagToggle = new ObservableBoolean(world.getDynamicProperty("ping_set0")??true,{clientWritable:true});
    const nameTagDisabled = new ObservableBoolean(!(world.getDynamicProperty("ping_set0")??true));
    const nameTagDropdown = new ObservableNumber(world.getDynamicProperty("ping_set1")??1,{clientWritable:true});
    //聊天名称 按钮 禁用 选项
    const chatNameToggle = new ObservableBoolean(world.getDynamicProperty("ping_set2")??true,{clientWritable:true});
    const chatNameDisabled = new ObservableBoolean(!(world.getDynamicProperty("ping_set2")??true));
    const chatNameDropdown = new ObservableNumber(world.getDynamicProperty("ping_set3")??0,{clientWritable:true});
    
    //开关监听
    nameTagToggle.subscribe(option=>{
        nameTagDisabled.setData(!option);
    });
    chatNameToggle.subscribe(option=>{
        chatNameDisabled.setData(!option);
    });
    
    const form = new CustomForm(player, "§a延迟显示设置")
        .spacer()
        .label("以下是有关延迟显示设置的设置")
        .spacer()
        .toggle("名称显示延迟",nameTagToggle,{description:"玩家头顶上方显示的名称"})
        .dropdown("名字Ping显示位置", nameTagDropdown,
            [
                {
                    label: "显示在名字左侧",
                    value: 0
                },
                {
                    label: "显示在名字右侧",
                    value: 1
                },
                {
                    label: "显示在名字下面",
                    value: 2
                }
            ],{description:"玩家名称的Ping显示位置",disabled: nameTagDisabled}
        )
        .toggle("聊天显示延迟",chatNameToggle,{description:"聊天文本带有Ping显示 有冲突请关闭此项"})
        .dropdown("聊天Ping显示位置", chatNameDropdown,
            [
                {
                    label: "显示在名字左侧",
                    value: 0
                },
                {
                    label: "显示在名字右侧",
                    value: 1
                }
            ],{description:"聊天时显示的Ping位置",disabled: chatNameDisabled}
        )
        .spacer()
        .button("保存设置",()=>{
            form.close();
            try {
                world.setDynamicProperty("ping_set0",nameTagToggle.getData());
                world.setDynamicProperty("ping_set1",nameTagDropdown.getData());
                world.setDynamicProperty("ping_set2",chatNameToggle.getData());
                world.setDynamicProperty("ping_set3",chatNameDropdown.getData());
                player.sendMessage(`§a已保存设置`);
                player.playSound("random.orb");
            } catch(e) {
                player.sendMessage(`§c保存设置报错: ${e}`)
            }
            return;
        })
        .divider()
        .label("其他")
        .spacer()
        .button("关于此行为包",()=>{
            form.close();
            system.runTimeout(()=>aboutUI(player),3);
            return;
        });
        
    form.show().catch(e => {
        player.sendMessage(`§c延迟显示设置UI报错: ${e}`);
    })
}

//关于
function aboutUI(player) {
    const form = new CustomForm(player, "关于此行为包")
        .divider()
        .label("名称: 玩家延迟显示\n作者: 安沁(ANQIN2)\n注释: SAPI的getPing()接口\n\n§e指令提示:§r\n/ping <玩家> §7-- 查询一个或多个玩家Ping§r\n/setting -- §7打开设置(上个界面)§r\n\n§a注意事项:§r\n如果与其他行为包或地图发送冲突(名称,聊天)关闭对应的选项即可\n")
        .button("返回设置",()=>{
            form.close();
            system.runTimeout(()=>setting(player),3);
        });
    form.show().catch(e => {
        player.sendMessage(`§c关于UI报错: ${e}`);
    })
}

//设置颜色
function setColor(ping) {
    if (ping==null||ping==undefined) return "";
    if (ping<70) {
        return "§a";
    } else if (ping>=70&&ping<150) {
        return "§e";
    } else if (ping>=150) {
        return "§c";
    }
}

//修改nameTag
system.runInterval(()=>{
    try {
        const isEnable = world.getDynamicProperty("ping_set0")??true;
        for (const player of world.getPlayers()) {
            if (!isEnable) {
                player.nameTag = player.name;
                continue;
            }
            if (player instanceof SimulatedPlayer) continue;
            const ping = player.getPing();
            if (ping==null||ping==undefined) continue;
            const color = setColor(ping);
            switch (world.getDynamicProperty("ping_set1")??1) {
                case 0:
                    player.nameTag = `${color}${ping}ms§r|${player.name}`;
                    break;
                case 1:
                    player.nameTag = `§r${player.name}|${color}${ping}ms§r`;
                    break;
                case 2:
                    player.nameTag = `§r${player.name}\n${color}${ping}ms§r`;
                    break;
            }
        }
    } catch(e) {
        console.error(`修改nameTag时报错: ${e}`);
    }
},60);

//发送信息
world.beforeEvents.chatSend.subscribe(event=>{
    if (!(world.getDynamicProperty("ping_set2")??true)) return;
    const { sender, message } = event;
    if (sender instanceof SimulatedPlayer) return;
    const ping = sender.getPing();
    if (ping==null||ping==undefined) return;
    const color = setColor(ping);
    
    try {
        event.cancel = true;
        switch (world.getDynamicProperty("ping_set3")??0) {
            case 0:
                world.sendMessage(`[${color}${ping}ms§r]<${sender.name}> ${message}`);
                break;
            case 1:
                world.sendMessage(`<${sender.name}>[${color}${ping}ms§r] ${message}`);
                break;
        }
    } catch(e) {
        console.error(`§c发送信息时报错: ${e}`);
        world.sendMessage(`<${sender.name}> ${message}`);
    }
});