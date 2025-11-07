[log] - [SpotifyAuth] OAuth callback detected {"hasCode":true,"hasState":true}
[log] - [SpotifyAuth] Invoking callback handler...
[log] - [Tab2] OAuth callback received, handling authentication...
[log] - [AuthStore] handleCallback invoked
[log] - [AuthStore] Exchanging code for tokens...
[log] - [SpotifyAuth] handleCallback called {"code":"AQByyhSFfC...","state":"5d67a9037d..."}
TO JS {"value":"5d67a9037d7ed90d0fe7b253f99df2ade88a775c97fdfb7aaad5eabc11fd02c6"}
To Native ->  Preferences get 111263297
[log] - [SpotifyAuth] State verification {"receivedState":"5d67a9037d...","storedState":"5d67a9037d...","matches":true}
TO JS {"value":"-C2EVt-4qWRexcBf7HRG~mtOsnlCbgud8VQ1xVVYg6YApBX_l-EMnoOtFX7y_QIw"}
[log] - [SpotifyAuth] Code verifier retrieved
[log] - [SpotifyAuth] Exchanging code for tokens via backend server...
[log] - [SpotifyAuth] Backend token URL: http://localhost:8080/auth/spotify/token
[error] - [SpotifyAuth] Error handling callback: {"message":"Network Error","name":"AxiosError","stack":"@capacitor://localhost/assets/index-CCJ4c6oK.js:236:98735\n@capacitor://localhost/assets/index-CCJ4c6oK.js:236:106872","config":{"transitional":{"silentJSONParsing":true,"forcedJSONParsing":true,"clarifyTimeoutError":false},"adapter":["xhr","http","fetch"],"transformRequest":[null],"transformResponse":[null],"timeout":0,"xsrfCookieName":"XSRF-TOKEN","xsrfHeaderName":"X-XSRF-TOKEN","maxContentLength":-1,"maxBodyLength":-1,"env":{},"headers":{"Accept":"application/json, text/plain, */*","Content-Type":"application/json"},"method":"post","url":"http://localhost:8080/auth/spotify/token","data":"{\"code\":\"AQByyhSFfCW_KWEW0LxFYdT4UmGmi6FL4JuPD9w7F9kyTnV0Ayy5abg72Huu6SGt1g5T5rBCmJ6Y9GIpZMflcrTZEETv4ozbHcjjMreIOoW3U_521rUovNyLqcZOD-N1r3ZfpPZO5cUQgWKqwSBMUaverNqf9afTFtpwTomiz67XxCyBsFWO_EXA3p40QdqywL9ObYWbnUctc6FKBsYEJPfIAB-oD0aGe4inVP7WzvhuPHTHRhcXxUMDL2fkQkYDxYEoUVR9qKqPvF0qNp5aruVRMV3DQDbawYjPo8-VBybTWSnOifjONEXeg5iizoaujihzlYIeO3-wuZtcbvPBQlv236wtBoR0x_LizKUYkfRMvfBFFY_bbuGcS5Z113jYEDgII97qOWi96gs6chMHIQYA1Ip-GiruwgTNUPXnLZ-7LAMNKvG5llxp1GUAtEholBy_J5MKahHkrxjEXsBpKJEhDn5vaZQ8\",\"code_verifier\":\"-C2EVt-4qWRexcBf7HRG~mtOsnlCbgud8VQ1xVVYg6YApBX_l-EMnoOtFX7y_QIw\"}","allowAbsoluteUrls":true},"code":"ERR_NETWORK"}
[error] - [SpotifyAuth] Axios error details: {"message":"Network Error"}
[error] - [AuthStore] Error in handleCallback: {}
[log] - [Tab2] Callback handled, refreshing auth status...
[log] - [AuthStore] checkAuthStatus called
[log] - [SpotifyAuth] Checking authentication status...
To Native ->  Preferences get 111263298
TO JS {"value":null}
[log] - [SpotifyAuth] No access token found
[log] - [AuthStore] Auth status check result: false
[log] - [AuthStore] User not authenticated
[log] - [Tab2] Auth status refreshed successfully
TO JS undefined
[error] - OAuth callback error: {}