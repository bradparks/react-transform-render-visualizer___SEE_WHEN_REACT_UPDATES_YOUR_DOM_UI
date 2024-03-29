import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import shouldPureComponentUpdate from 'react-pure-render/function';

const RenderVisualizer = {
  UPDATE_RENDER_LOG_POSITION_INTERVAL_MS: 500,
  MAX_LOG_LENGTH: 20,

  STATE_CHANGES: {
    MOUNT: 'mount',
    UPDATE: 'update'
  },

  styling: {
    renderLog: {
      color: 'rgb(85, 85, 85)',
      fontFamily: '\'Helvetica Neue\', Arial, Helvetica, sans-serif',
      fontSize: '14px',
      lineHeight: '18px',
      background: 'linear-gradient(#fff, #ccc)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      textShadow: '0 1px 0 #fff',
      borderRadius: '7px',
      position: 'absolute',
      top: 0,
      left: 0,
      maxWidth: '70%',
      padding: '5px 10px',
      zIndex: '10000',
      transition: '.3s all'
    },
    renderLogDetailNotes: {
      color: 'red',
      textAlign: 'center'
    },
    elementHighlightMonitor: {
      outline: '1px solid rgba(47, 150, 180, 1)'
    },
    elementHighlightMount: {
      outline: '3px solid rgba(197, 16, 12, 1)'
    },
    elementHighlightUpdate: {
      outline: '3px solid rgba(197, 203, 1, 1)'
    }
  }
};
let persistentId = 0;
if (!window.renders) {
  window.renders = new Map();
}

const containingElement = document.createElement('div');
document.body.appendChild(containingElement);

const addToRenderLog = function (inst, message) {
  if (!window.renders.get(inst)) {
    return;
  }
  let { log, count, ...others } = window.renders.get(inst);


  log = [`${ count } ) ${ message }`, ...log];
  log.splice(RenderVisualizer.MAX_LOG_LENGTH, 1);

  count++;

  window.renders.set(inst, {
    ...others,
    log,
    count
  });
};


/*
 * Get the changes made to props or state.  In the event this component has its own
 * shouldComponentUpdate, don't do
 * anything
 * @param object prevProps
 * @param object prevState
 * @param object nextProps
 * @param object nextState
 * @return boolean
 */
function getReasonForReRender (prevProps, prevState, nextProps, nextState) {
  for (let key in nextState) {
    if (nextState.hasOwnProperty(key) && nextState[key] !== prevState[key]) {
      if (typeof nextState[key] === 'object') {
        return `this.state[${ key }] changed`;
      } else {
        return `this.state[${ key }] changed: '${ prevState[key] }' => '${ nextState[key] }'`;
      }
    }
  }

  for (let key in nextProps) {
    if (nextProps.hasOwnProperty(key) && nextProps[key] !== prevProps[key]) {
      if (typeof nextProps[key] === 'object') {
        return `this.props[${ key }] changed`;
      } else {
        return `this.props[${ key }] changed: '${ prevProps[key] }' => '${ nextProps[key] }'`;
      }
    }
  }

  return 'unknown reason for update, possibly from forceUpdate()';
}

class RenderLog extends Component {
  static displayName = 'RenderLog';
  shouldComponentUpdate = shouldPureComponentUpdate;

  static defaultProps = {
    log: [],
    count: 1,
    node: null
  };
  static propTypes = {
    log: PropTypes.instanceOf(Array),
    count: PropTypes.number,
    node: PropTypes.object,
    posTop: PropTypes.number,
    posLeft: PropTypes.number
  };

  constructor () {
    super(...arguments);
    this.state = {
      showDetails: false
    };
  }

  componentWillMount () {
    this.highlightChange(RenderVisualizer.STATE_CHANGES.MOUNT);
  }

  componentDidUpdate () {
    this.highlightChange(RenderVisualizer.STATE_CHANGES.UPDATE);

  }

  /*
   * Highlight any change by adding an animation style to the component DOM node
   * @param String change - The type of change being made to the node
   * @return void
   */
  highlightChange (change) {
    const parentNode = ReactDOM.findDOMNode(this.props.node);
    const ANIMATION_DURATION = 500;

    if (parentNode) {
      parentNode.style.boxSizing = 'border-box';

      window.requestAnimationFrame(() => {
        parentNode.animate([
          change === RenderVisualizer.STATE_CHANGES.MOUNT ?
            RenderVisualizer.styling.elementHighlightMount :
            RenderVisualizer.styling.elementHighlightUpdate,
          RenderVisualizer.styling.elementHighlightMonitor
        ], {
          duration: ANIMATION_DURATION
        });
      });
    }
  }
  render () {
    return (
      <div style={{
        ...RenderVisualizer.styling.renderLog,
        transform: `translate3d(${this.props.posLeft}px, ${this.props.posTop}px, 0)`
      }} onClick={() => {
        this.setState({
          showDetails: !this.state.showDetails
        });
      }}>
        <div style={{ display: this.state.showDetails ? 'none' : 'block' }}>{ this.props.count }</div>
        <div style={{ display: this.state.showDetails ? 'block' : 'none' }}>
          <div>
            {
              this.props.log.map((message, i) => {
                return <div key={i}>{message}</div>;
              })
            }
          </div>
          <div style={RenderVisualizer.styling.renderLogDetailNode}></div>
        </div>
      </div>
    );
  }
}


class RenderLogs extends Component {
  static displayName = 'RenderLogs';

  static propTypes = {
    renders: PropTypes.object
  };

  render () {
    const renderLogs = [];
    this.props.renders.forEach((val, key) => {
      renderLogs.push(<RenderLog key={val.id} {...val} node={key} />);
    });
    return <div>{ renderLogs }</div>;
  }
}


window.setInterval(() => {
  window.renders.forEach((val, node) => {
    const parentNode = ReactDOM.findDOMNode(node);
    const parentNodeRect = parentNode && parentNode.getBoundingClientRect();

    if (parentNodeRect) {
      window.renders.set(node, {
        ...val,
        posTop: window.pageYOffset + parentNodeRect.top,
        posLeft: parentNodeRect.left
      });
    }
  });
  ReactDOM.render(React.createElement(RenderLogs, { renders: window.renders }), containingElement);
}, RenderVisualizer.UPDATE_RENDER_LOG_POSITION_INTERVAL_MS);
ReactDOM.render(React.createElement(RenderLogs, { renders: window.renders }), containingElement);

export default function renderVisualizer () {
  return function wrapRenderVisualizer (ReactClass, componentId) {

    const old = {
      componentDidMount: ReactClass.prototype.componentDidMount,
      componentDidUpdate: ReactClass.prototype.componentDidUpdate,
      componentWillUnmount: ReactClass.prototype.componentWillUnmount
    };

    ReactClass.prototype.componentDidMount = function () {
      window.renders.set(this, {
        id: persistentId++,
        log: [],
        count: 0,

        posTop: 0,
        posLeft: 0
      });
      addToRenderLog(this, 'Initial Render');

      if (old.componentDidMount) {
        return old.componentDidMount(...arguments);
      }
    };
    ReactClass.prototype.componentDidUpdate = function (prevProps, prevState) {
      addToRenderLog(this, getReasonForReRender(prevProps, prevState, this.props, this.state));

      if (old.componentDidUpdate) {
        return old.componentDidUpdate(...arguments);
      }
    };
    ReactClass.prototype.componentWillUnmount = function () {
      window.renders.delete(this);

      if (old.componentWillUnmount) {
        return old.componentWillUnmount(...arguments);
      }
    };

    return ReactClass;
  };
}
