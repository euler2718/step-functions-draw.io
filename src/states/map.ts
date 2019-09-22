import * as awssfUtils from "../utils";
import { registCodec, createState, awssfStateHandler } from "./helper";

function MapStateHandler (state) {
  this.custom = function () {
    this.domNode.appendChild(NextEdge.prototype.createHandlerImage.apply(this, arguments));
    this.domNode.appendChild(CatchEdge.prototype.createHandlerImage.apply(this, arguments));
    this.domNode.appendChild(RetryEdge.prototype.createHandlerImage.apply(this, arguments));
  };
  awssfStateHandler.apply(this, arguments);
}
mxUtils.extend(MapStateHandler, awssfStateHandler);

export class MapState {
  type = 'Map'
  hiddenAttributes = ['branches']
  create (label, json) {
    if (!json) json = {};
    var style = 'swimlane;whiteSpace=wrap;html=1;dashed=0;gradientColor=none';
    var cell = createState(this, label, style);
    var pt = cell.getGeometry();
    cell.setGeometry(new mxGeometry(pt.x, pt.y, 480, 200));
    cell.setAttribute('result_path', json.ResultPath || '');
    cell.setAttribute('branches', '');
    var sp = StartPoint.prototype.create(new mxGeometry((cell.geometry.width - 30)/2, 40, 30, 30));
    cell.insert(sp);
    if (Object.keys(json).length === 0) {
      var task1 = TaskState.prototype.create();
      task1.setGeometry(new mxGeometry(80, 80, task1.geometry.width, task1.geometry.height));
      cell.insert(task1);
      var edge1 = StartAtEdge.prototype.create('StartAt', sp, task1);
      cell.insert(edge1);
      var task2 = TaskState.prototype.create();
      task2.setGeometry(new mxGeometry(320, 80, task2.geometry.width, task2.geometry.height));
      cell.insert(task2);
      var edge2 = StartAtEdge.prototype.create('StartAt', sp, task2);
      cell.insert(edge2);
    }
    return cell;
  }
  createDefaultEdge (src) {
    for (var i in src.edges) {
      var edge = src.edges[i];
      if ((edge.source == src) && awssfUtils.isNext(edge))
        return CatchEdge.prototype.create();
    }
    return NextEdge.prototype.create();
  }
  validate (cell, res) {
    return awssfUtils.validateCommonAttributes(cell, res, true);
  }
  expJSON (cell, cells) {
    var data = {};
    var label = cell.getAttribute("label");
    data[label] = {
      Type: "Map",
      Branches: []
    };
    if (cell.getAttribute("comment"))
      data[label].Comment = cell.getAttribute("comment");
    if (cell.getAttribute("input_path"))
      data[label].InputPath = awssfUtils.adjustJsonPath(cell.getAttribute("input_path"));
    if (cell.getAttribute("output_path"))
      data[label].OutputPath = awssfUtils.adjustJsonPath(cell.getAttribute("output_path"));
    if (cell.getAttribute("result_path"))
      data[label].ResultPath = awssfUtils.adjustJsonPath(cell.getAttribute("result_path"));
  
    var startat = [];
    for(const child of cell.children) {
      if (!awssfUtils.isStart(child)) continue;
      for(const edge of child.edges) {
        if (edge.target == child) continue;
        if (awssfUtils.isStartAt(edge)) {
          startat.push(cells[edge.target.id]);
        }
      }
    }
  
    function traceAll (state, res) {
      res.push(state);
      for(var j in state.edges) {
        var edge = state.edges[j];
        if (edge.target == state) continue;
        traceAll(cells[edge.target.id], res);
      }
      return res;
    }
    for(const start of startat) {
      var branch = [];
      traceAll(start, branch);
      var states = {};
      for(const child of branch) {
        if (child.value == null || typeof(child.value) != "object") continue;
        if (!awssfUtils.isAWSsf(child)) continue;
        if (awssfUtils.isStart(child) || awssfUtils.isEnd(cell)) continue;
        if (child.isVertex()) {
          if (awssfUtils.isParallel(child)) continue;
          if (child.awssf &&  child.awssf.expJSON) {
            Object.assign(states, child.awssf.expJSON(child, cells));
          }
        }
      }
      data[label].Branches.push({
        StartAt: start.getAttribute("label"),
        States: states
      });
    }
    var existNextEdge = false;
    if (cell.edges) {
      var sortedEdges = cell.edges.sort(function (a, b) {
        if (Number(a.getAttribute("weight")) > Number(b.getAttribute("weight"))) return -1;
        if (Number(a.getAttribute("weight")) < Number(b.getAttribute("weight"))) return 1;
        return 0;
      });
      for(const edge of sortedEdges) {
        if (edge.source != cell) continue;
        if (edge.awssf.expJSON) {
          if (awssfUtils.isRetry(edge)) {
            if (!data[label]["Retry"]) data[label]["Retry"] = [];
            data[label]["Retry"].push(edge.awssf.expJSON(edge, cells));
          } else if (awssfUtils.isCatch(edge)) {
            if (!data[label]["Catch"]) data[label]["Catch"] = [];
            data[label]["Catch"].push(edge.awssf.expJSON(edge, cells));
          }else if (awssfUtils.isNext(edge)) {
            existNextEdge = true;
            Object.assign(data[label], edge.awssf.expJSON(edge, cells));
          }
        }
      }
    }
    if (existNextEdge == false || data[label].Next == 'End') {
      delete data[label]['Next'];
      data[label]["End"] = true;
    }
    return data;
  
  }
  handler = MapStateHandler
}

registCodec(MapState);