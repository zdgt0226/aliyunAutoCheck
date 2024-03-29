/*
阿里云盘自动签到工具
*/

const accesssTokenURL = "https://auth.aliyundrive.com/v2/account/token";
const siginURL = "https://member.aliyundrive.com/v1/activity/sign_in_list";
const rewardURL = "https://member.aliyundrive.com/v1/activity/sign_in_reward";
const goodURL = "https://member.aliyundrive.com/v1/activity/sign_in_goods";
function aliyunCheckin() {
  // 从 google 表格中获取 refresh_token 列表
  var sheet = SpreadsheetApp.getActiveSheet();
  var range = sheet.getRange(1, 1, sheet.getLastRow()).getValues();
  var refreshTokenList = range.map(function (i) {
    return i[0];
  });
  var message = {};
  for (var index in refreshTokenList) {
    try {
      var queryBody = {
        grant_type: "refresh_token",
        refresh_token: refreshTokenList[index],
      };
      // 使用 refresh_token 获取 access_token
      var accessRep = UrlFetchApp.fetch(accesssTokenURL, {
        method: "POST",
        contentType: "application/json; charset=UTF-8",
        payload: JSON.stringify(queryBody),
      });
      var accessToken = JSON.parse(accessRep).access_token;
      var newRefresh_token = JSON.parse(accessRep).refresh_token;
      var _index = parseInt(index) + 1;
      sheet.getRange(_index, 1).setValue(newRefresh_token);
      var nickName = JSON.parse(accessRep).nick_name;
      // 签到
      try {
        var checkRep = UrlFetchApp.fetch(siginURL, {
          method: "POST",
          contentType: "application/json; charset=UTF-8",
          payload: JSON.stringify(queryBody),
          headers: {
            Authorization: "Bearer " + accessToken,
          },
        });
        var { signInLogs, signInCount } = JSON.parse(checkRep).result;
        var signInArray = signInLogs.filter(function (day) {
          return day.status === "normal";
        }); //获取当月签到的记录
        var currentSignIn = signInArray[signInCount - 1];
        //签到之后默认奖品是没有领取的，故以下的isReward值应为false
        if (!currentSignIn.isReward) {
          //基于阿里云规则增加奖品领取的功能
          try {
            var rewardRep = UrlFetchApp.fetch(rewardURL, {
              'method': 'POST',
              'contentType': 'application/json; charset=UTF-8',
              'payload': JSON.stringify(Object.assign(queryBody, {
                'signInDay': signInCount
              })),
              'headers': {
                'Authorization': 'Bearer ' + accessToken
              }
            });
            var rewardStatus = JSON.parse(rewardRep);
          } catch(e) {
            var signInReward = '领取失败：' + '错误信息' + e;
            break;
          };
          if (rewardStatus.success) {
            var signInReward = rewardStatus.result.notice;
          } else {
            var signInReward = '领取失败';
          };
        } else {
          //对已领取的情况进行领取信息的获取，避免出现错误的领取信息
          try {
            var isGoodRep = UrlFetchApp.fetch(goodURL, {
              'method': 'POST',
              'contentType': 'application/json; charset=UTF-8',
              'payload': JSON.stringify(queryBody),
              'headers': {
                'Authorization': 'Bearer '+ accessToken
                }
              }
            );
            var isGoodLogs = JSON.parse(isGoodRep);
            var signInReward = isGoodLogs.result.rewardName;
          } catch(e) {
            break;
          };
        };
        message["账号： " + nickName] = {
          本月已签到: signInCount,
          签到奖励: signInReward,
        };
      } catch (e) {
        message["账号： " + nickName] = {
          "签到失败，错误信息": e,
        };
        break;
      }
    } catch (e) {
      message["账号编号： " + String(index + 1)] = {
        "获取 access_token 失败，错误信息": e,
      };
      break;
    }
  }
  // 将签到的信息发送至邮箱
  var email = Session.getActiveUser().getEmail();
  var htmlTemplate = HtmlService.createTemplateFromFile("Index");
  htmlTemplate.data = message;
  var htmlBody = htmlTemplate.evaluate().getContent();
  var subject =
    "阿里云盘签到——" + Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd");
  GmailApp.sendEmail(email, subject, "", {
    htmlBody: htmlBody,
  });
}
