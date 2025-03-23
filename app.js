// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'name-xxx', // 请填入您的环境ID
        traceUser: true
      })
    }

    // 获取系统信息
    wx.getSystemInfo({
      success: e => {
        this.globalData.StatusBar = e.statusBarHeight;
        this.globalData.darkMode = e.theme === 'dark';
      }
    })
  },

  globalData: {
    StatusBar: 0,
    darkMode: false,
    currentVersion: '2.6.0',  // 当前版本号
    nextVersion: '3.0',        // 下一版本号
    iconBaseUrl: 'https://yourIconPathServerAddress.com' // 统一的图标路径服务器地址
  }
});
