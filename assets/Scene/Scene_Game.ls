{
  "_$ver": 1,
  "_$id": "4ykjsdd2",
  "_$type": "Scene",
  "left": 0,
  "right": 0,
  "top": 0,
  "bottom": 0,
  "name": "Scene_Game",
  "width": 1080,
  "height": 2160,
  "_$comp": [
    {
      "_$type": "4f46b4cd-ddcb-44a5-899f-3f7457f9383c",
      "scriptPath": "../src/Client/Scene_Game.ts",
      "List_1": {
        "_$ref": "vpphjdzf"
      },
      "List_2": {
        "_$ref": "2amtfosf"
      },
      "info": {
        "_$ref": "6xfoj1wa"
      },
      "TipsButton": {
        "_$ref": "24434pea"
      },
      "downButton": {
        "_$ref": "zwyq6hd2"
      },
      "RankButton": {
        "_$ref": "fbvh11rt"
      },
      "My_score_Number": {
        "_$ref": "asn2xu2t"
      },
      "questionUrl": "resources/Gameinfo/dic_dongbei.json",
      "rankUrl": "http://localhost:3000/api/rank",
      "scoreUrl": "http://localhost:3000/api/score",
      "questionsPerLevel": 50,
      "distractorMin": 2,
      "distractorMax": 3,
      "distractorPerLevel": 1,
      "tipCost": 20,
      "cellWidth": 200,
      "cellHeight": 200,
      "spaceX": 50,
      "spaceY": 15
    }
  ],
  "_$child": [
    {
      "_$id": "t3uoirup",
      "_$type": "Image",
      "name": "background",
      "width": 1080,
      "height": 2160,
      "skin": "res://ed173e25-c115-4cf8-abc6-a45cec8387c7",
      "color": "#ffffff"
    },
    {
      "_$id": "cyl264xc",
      "_$type": "Image",
      "name": "wenzicao_bg",
      "x": 60,
      "y": 1300,
      "width": 960,
      "height": 420,
      "skin": "res://b59a6ffb-7e51-492b-8116-8fc5ffaeae0f",
      "color": "#ffffff"
    },
    {
      "_$id": "vpphjdzf",
      "_$type": "List",
      "name": "List_1",
      "x": 60,
      "y": 400,
      "width": 960,
      "height": 420,
      "_mouseState": 2,
      "itemTemplate": {
        "_$ref": "oczkndzs",
        "_$tmpl": "itemRender"
      },
      "repeatX": 4,
      "repeatY": 2,
      "elasticEnabled": true,
      "spaceX": 50,
      "spaceY": 15,
      "scrollType": 2,
      "_$child": [
        {
          "_$id": "oczkndzs",
          "_$type": "Box",
          "name": "Box_1",
          "width": 200,
          "height": 200,
          "_$child": [
            {
              "_$id": "pv64kqu3",
              "_$type": "Image",
              "name": "bg_1",
              "width": 200,
              "height": 200,
              "skin": "res://0c2cf088-79a8-4481-8328-a75358fc478b",
              "color": "#ffffff",
              "_$child": [
                {
                  "_$id": "ftcmqh57",
                  "_$type": "Label",
                  "name": "Label_1",
                  "width": 200,
                  "height": 200,
                  "text": "妈",
                  "fontSize": 100,
                  "color": "#FFFFFF",
                  "bold": true,
                  "align": "center",
                  "valign": "middle",
                  "padding": "0,0,0,0"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "_$id": "z147e9pj",
      "_$type": "Panel",
      "name": "Panel",
      "x": 60,
      "y": 857,
      "width": 960,
      "height": 360,
      "_mouseState": 2,
      "scrollType": 2,
      "_$child": [
        {
          "_$id": "6xfoj1wa",
          "_$type": "Label",
          "name": "info",
          "width": 960,
          "height": 124,
          "text": "东北话解析啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊",
          "fontSize": 60,
          "color": "#FFFFFF",
          "fitContent": "height",
          "valign": "top",
          "wordWrap": true,
          "padding": "0,0,0,0"
        }
      ]
    },
    {
      "_$id": "24434pea",
      "_$type": "Button",
      "name": "TipsButton",
      "x": 60,
      "y": 1917,
      "width": 240,
      "height": 240,
      "_mouseState": 2,
      "skin": "",
      "label": "提示",
      "labelSize": 60,
      "labelAlign": "center",
      "labelVAlign": "middle"
    },
    {
      "_$id": "zwyq6hd2",
      "_$type": "Button",
      "name": "downButton",
      "x": 400,
      "y": 1917,
      "width": 240,
      "height": 240,
      "_mouseState": 2,
      "skin": "",
      "label": "卸下",
      "labelSize": 60,
      "labelAlign": "center",
      "labelVAlign": "middle"
    },
    {
      "_$id": "fbvh11rt",
      "_$type": "Button",
      "name": "RankButton",
      "x": 740,
      "y": 1917,
      "width": 240,
      "height": 240,
      "_mouseState": 2,
      "skin": "",
      "label": "排行榜",
      "labelSize": 60,
      "labelAlign": "center",
      "labelVAlign": "middle"
    },
    {
      "_$id": "98vn52mx",
      "_$type": "Box",
      "name": "score_Box",
      "x": 60,
      "y": 1750,
      "width": 960,
      "height": 200,
      "_$child": [
        {
          "_$id": "jnaknm6f",
          "_$type": "Label",
          "name": "My_score_Label",
          "x": 92,
          "y": 60,
          "width": 348,
          "height": 80,
          "text": "我的得分：",
          "fontSize": 64,
          "color": "#FFFFFF",
          "valign": "top",
          "padding": "0,0,0,0"
        },
        {
          "_$id": "asn2xu2t",
          "_$type": "Label",
          "name": "My_score_Number",
          "x": 440,
          "y": 60,
          "width": 348,
          "height": 80,
          "text": "999999",
          "fontSize": 64,
          "color": "#FFFFFF",
          "align": "center",
          "valign": "top",
          "padding": "0,0,0,0"
        }
      ]
    },
    {
      "_$id": "2amtfosf",
      "_$type": "List",
      "name": "List_2",
      "x": 60,
      "y": 1300,
      "width": 960,
      "height": 420,
      "_mouseState": 2,
      "itemTemplate": {
        "_$ref": "ppxotv37",
        "_$tmpl": "itemRender"
      },
      "repeatX": 4,
      "repeatY": 2,
      "elasticEnabled": true,
      "spaceX": 50,
      "spaceY": 15,
      "scrollType": 2,
      "_$child": [
        {
          "_$id": "ppxotv37",
          "_$type": "Box",
          "name": "Box_2",
          "width": 200,
          "height": 200,
          "_$child": [
            {
              "_$id": "zrb33rsx",
              "_$type": "Image",
              "name": "bg_2",
              "width": 200,
              "height": 200,
              "skin": "res://0c2cf088-79a8-4481-8328-a75358fc478b",
              "color": "#ffffff",
              "_$child": [
                {
                  "_$id": "gfs6picu",
                  "_$type": "Label",
                  "name": "Label_2",
                  "width": 200,
                  "height": 200,
                  "text": "妈",
                  "fontSize": 100,
                  "color": "#FFFFFF",
                  "bold": true,
                  "align": "center",
                  "valign": "middle",
                  "padding": "0,0,0,0",
                  "stroke": 20
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}